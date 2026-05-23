import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService, Prisma } from "@llm-observe/db";
import { redactPII } from "@llm-observe/pii";
import { withSpan } from "@llm-observe/telemetry";
import type { InferenceLogPayload } from "@llm-observe/types";

@Processor("inference-logs")
export class LogProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<InferenceLogPayload>) {
    return withSpan(
      "worker.process_log",
      {
        "ingest.log_id": job.data.logId,
        "llm.provider": job.data.provider,
        "job.id": job.id ?? "unknown",
      },
      () => this.persistLog(job.data),
    );
  }

  private async persistLog(payload: InferenceLogPayload) {

    let inputPreview = payload.inputPreview;
    let outputPreview = payload.outputPreview;
    let piiRedacted = false;

    if (inputPreview) {
      const r = redactPII(inputPreview);
      inputPreview = r.redacted;
      piiRedacted = piiRedacted || r.didRedact;
    }
    if (outputPreview) {
      const r = redactPII(outputPreview);
      outputPreview = r.redacted;
      piiRedacted = piiRedacted || r.didRedact;
    }

    await this.prisma.inferenceLog.upsert({
      where: { id: payload.logId },
      create: {
        id: payload.logId,
        conversationId: payload.conversationId,
        sessionId: payload.sessionId,
        provider: payload.provider,
        model: payload.model,
        status: payload.status,
        requestStartedAt: new Date(payload.requestStartedAt),
        firstTokenAt: payload.firstTokenAt
          ? new Date(payload.firstTokenAt)
          : null,
        requestEndedAt: payload.requestEndedAt
          ? new Date(payload.requestEndedAt)
          : null,
        latencyMs: payload.latencyMs,
        ttftMs: payload.ttftMs,
        promptTokens: payload.promptTokens,
        completionTokens: payload.completionTokens,
        totalTokens: payload.totalTokens,
        inputPreview,
        outputPreview,
        errorCode: payload.errorCode,
        errorMessage: payload.errorMessage,
        metadata: payload.metadata as Prisma.InputJsonValue | undefined,
        piiRedacted,
      },
      update: {
        conversationId: payload.conversationId,
        sessionId: payload.sessionId,
        provider: payload.provider,
        model: payload.model,
        status: payload.status,
        requestStartedAt: new Date(payload.requestStartedAt),
        firstTokenAt: payload.firstTokenAt
          ? new Date(payload.firstTokenAt)
          : null,
        requestEndedAt: payload.requestEndedAt
          ? new Date(payload.requestEndedAt)
          : null,
        latencyMs: payload.latencyMs,
        ttftMs: payload.ttftMs,
        promptTokens: payload.promptTokens,
        completionTokens: payload.completionTokens,
        totalTokens: payload.totalTokens,
        inputPreview,
        outputPreview,
        errorCode: payload.errorCode,
        errorMessage: payload.errorMessage,
        metadata: payload.metadata as Prisma.InputJsonValue | undefined,
        piiRedacted,
      },
    });

    this.events.emit("inference.log_processed", { logId: payload.logId });
  }
}
