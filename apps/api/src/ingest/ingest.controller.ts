import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { IngestService } from "./ingest.service";

@Controller("ingest")
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post()
  @HttpCode(202)
  async ingest(@Body() payload: unknown) {
    await this.ingestService.enqueue(payload);
    return { accepted: true };
  }
}
