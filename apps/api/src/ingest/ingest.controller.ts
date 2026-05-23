import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IngestThrottlerGuard } from "../common/throttler.guards";
import { IngestService } from "./ingest.service";

@Controller("ingest")
@UseGuards(IngestThrottlerGuard)
@Throttle({ ingest: { limit: 120, ttl: 60_000 } })
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post()
  @HttpCode(202)
  async ingest(@Body() payload: unknown) {
    await this.ingestService.enqueue(payload);
    return { accepted: true };
  }
}
