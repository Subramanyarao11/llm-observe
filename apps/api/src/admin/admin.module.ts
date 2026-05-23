import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AdminController } from "./admin.controller";

@Module({
  imports: [BullModule.registerQueue({ name: "inference-logs" })],
  controllers: [AdminController],
})
export class AdminModule {}
