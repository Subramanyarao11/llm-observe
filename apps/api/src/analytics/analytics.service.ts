import { Injectable } from "@nestjs/common";
import { PrismaService } from "@llm-observe/db";

type Window = "1h" | "24h" | "7d";

function windowToDate(window: Window): Date {
  const ms =
    window === "1h" ? 3600000 : window === "24h" ? 86400000 : 604800000;
  return new Date(Date.now() - ms);
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async latency(window: Window = "24h"): Promise<unknown> {
    const since = windowToDate(window);
    const rows = await this.prisma.inferenceLog.groupBy({
      by: ["provider"],
      where: { createdAt: { gte: since }, status: "success" },
      _avg: { latencyMs: true, ttftMs: true },
      _count: true,
    });
    return rows;
  }

  async throughput(window: Window = "24h"): Promise<
    { hour: string; provider: string; count: number; tokens: number }[]
  > {
    const since = windowToDate(window);
    const logs = await this.prisma.inferenceLog.findMany({
      where: { createdAt: { gte: since } },
      select: {
        createdAt: true,
        provider: true,
        totalTokens: true,
        promptTokens: true,
        completionTokens: true,
      },
    });

    const buckets = new Map<
      string,
      { hour: string; provider: string; count: number; tokens: number }
    >();

    for (const log of logs) {
      const hour = log.createdAt.toISOString().slice(0, 13);
      const key = `${hour}-${log.provider}`;
      const existing = buckets.get(key) ?? {
        hour,
        provider: log.provider,
        count: 0,
        tokens: 0,
      };
      existing.count += 1;
      existing.tokens +=
        log.totalTokens ??
        (log.promptTokens ?? 0) + (log.completionTokens ?? 0);
      buckets.set(key, existing);
    }

    return Array.from(buckets.values()).sort((a, b) =>
      a.hour.localeCompare(b.hour),
    );
  }

  async errors(window: Window = "24h"): Promise<{
    errorRate: number;
    totalErrors: number;
    byCode: unknown;
    byProvider: unknown;
  }> {
    const since = windowToDate(window);
    const [total, errorCount, byCode, byProvider] = await Promise.all([
      this.prisma.inferenceLog.count({
        where: { createdAt: { gte: since } },
      }),
      this.prisma.inferenceLog.count({
        where: { createdAt: { gte: since }, status: "error" },
      }),
      this.prisma.inferenceLog.groupBy({
        by: ["errorCode"],
        where: { createdAt: { gte: since }, status: "error" },
        _count: true,
      }),
      this.prisma.inferenceLog.groupBy({
        by: ["provider"],
        where: { createdAt: { gte: since }, status: "error" },
        _count: true,
      }),
    ]);

    return {
      errorRate: total > 0 ? errorCount / total : 0,
      totalErrors: errorCount,
      byCode,
      byProvider,
    };
  }

  async summary(): Promise<{
    totalRequests: number;
    avgLatencyMs: number;
    successRate: number;
    totalTokens: number;
  }> {
    const since = windowToDate("24h");
    const [total, success, aggregates] = await Promise.all([
      this.prisma.inferenceLog.count({
        where: { createdAt: { gte: since } },
      }),
      this.prisma.inferenceLog.count({
        where: { createdAt: { gte: since }, status: "success" },
      }),
      this.prisma.inferenceLog.aggregate({
        where: { createdAt: { gte: since } },
        _avg: { latencyMs: true },
        _sum: {
          totalTokens: true,
          promptTokens: true,
          completionTokens: true,
        },
      }),
    ]);

    const summedTotal =
      aggregates._sum.totalTokens ??
      (aggregates._sum.promptTokens ?? 0) +
        (aggregates._sum.completionTokens ?? 0);

    return {
      totalRequests: total,
      avgLatencyMs: aggregates._avg.latencyMs ?? 0,
      successRate: total > 0 ? success / total : 0,
      totalTokens: summedTotal,
    };
  }

  async recentErrors(window: Window = "24h") {
    const since = windowToDate(window);
    return this.prisma.inferenceLog.findMany({
      where: { createdAt: { gte: since }, status: "error" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        errorCode: true,
        errorMessage: true,
        conversationId: true,
        provider: true,
        model: true,
        createdAt: true,
      },
    });
  }

  async logs(
    window: Window = "24h",
    provider?: string,
    hour?: string,
  ) {
    const since = windowToDate(window);
    const logs = await this.prisma.inferenceLog.findMany({
      where: {
        createdAt: { gte: since },
        ...(provider ? { provider } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        conversationId: true,
        sessionId: true,
        provider: true,
        model: true,
        status: true,
        latencyMs: true,
        ttftMs: true,
        totalTokens: true,
        promptTokens: true,
        completionTokens: true,
        errorCode: true,
        createdAt: true,
      },
    });

    if (!hour) return logs;
    return logs.filter((log) => log.createdAt.toISOString().startsWith(hour));
  }
}
