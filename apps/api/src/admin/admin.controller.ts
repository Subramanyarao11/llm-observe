import { Controller, Get, Query } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Controller("admin")
export class AdminController {
  constructor(
    @InjectQueue("inference-logs") private readonly queue: Queue,
  ) {}

  @Get("failed-jobs")
  async failedJobs(@Query("start") start = "0", @Query("end") end = "50") {
    const startIndex = Math.max(0, Number(start) || 0);
    const endIndex = Math.max(startIndex + 1, Number(end) || 50);
    const failed = await this.queue.getFailed(startIndex, endIndex - 1);

    return {
      count: failed.length,
      jobs: failed.map((job) => ({
        id: job.id,
        name: job.name,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        data: {
          logId: job.data.logId,
          conversationId: job.data.conversationId,
          sessionId: job.data.sessionId,
          provider: job.data.provider,
          model: job.data.model,
          status: job.data.status,
        },
      })),
    };
  }
}
