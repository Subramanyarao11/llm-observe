import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { IngestController } from "./ingest.controller";
import { IngestService } from "./ingest.service";

@Module({
  imports: [BullModule.registerQueue({ name: "inference-logs" })],
  controllers: [IngestController],
  providers: [IngestService],
})
export class IngestModule {}
