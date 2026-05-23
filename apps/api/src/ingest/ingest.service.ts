import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { withSpan } from "@llm-observe/telemetry";
import { InferenceLogPayloadSchema } from "@llm-observe/types";

@Injectable()
export class IngestService {
  constructor(
    @InjectQueue("inference-logs") private readonly queue: Queue,
    private readonly events: EventEmitter2,
  ) {}

  async enqueue(rawPayload: unknown) {
    return withSpan(
      "ingest.enqueue",
      {
        "ingest.log_id":
          typeof rawPayload === "object" &&
          rawPayload !== null &&
          "logId" in rawPayload
            ? String((rawPayload as { logId: unknown }).logId)
            : undefined,
      },
      async () => {
        const payload = InferenceLogPayloadSchema.parse(rawPayload);
        await this.queue.add("process-log", payload, {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        });
        this.events.emit("inference.log_received", { logId: payload.logId });
        return payload;
      },
    );
  }
}
