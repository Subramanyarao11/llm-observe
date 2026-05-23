import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "@llm-observe/db";
import { redactPII } from "@llm-observe/pii";
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
    const payload = job.data;

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

    await this.prisma.inferenceLog.create({
      data: {
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
        metadata: payload.metadata as object | undefined,
        piiRedacted,
      },
    });

    this.events.emit("inference.log_processed", { logId: payload.logId });
  }
}
