import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "@llm-observe/db";

export type DependencyStatus = "up" | "down";

export interface HealthCheckResult {
  status: "ok" | "degraded";
  postgres: { status: DependencyStatus; latencyMs?: number; error?: string };
  redis: { status: DependencyStatus; latencyMs?: number; error?: string };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue("inference-logs") private readonly queue: Queue,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const [postgres, redis] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
    ]);

    const status =
      postgres.status === "up" && redis.status === "up" ? "ok" : "degraded";

    return { status, postgres, redis };
  }

  private async checkPostgres(): Promise<HealthCheckResult["postgres"]> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "up", latencyMs: Date.now() - started };
    } catch (err: unknown) {
      return {
        status: "down",
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : "Postgres check failed",
      };
    }
  }

  private async checkRedis(): Promise<HealthCheckResult["redis"]> {
    const started = Date.now();
    try {
      await this.queue.getJobCounts();
      return { status: "up", latencyMs: Date.now() - started };
    } catch (err: unknown) {
      return {
        status: "down",
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : "Redis check failed",
      };
    }
  }
}
