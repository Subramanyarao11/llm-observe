import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { PrismaModule } from "@llm-observe/db";
import { LogProcessor } from "./log.processor";

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
  };
}

@Module({
  imports: [
    PrismaModule,
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      connection: parseRedisUrl(
        process.env.REDIS_URL ?? "redis://localhost:6379",
      ),
    }),
    BullModule.registerQueue({ name: "inference-logs" }),
  ],
  providers: [LogProcessor],
})
export class WorkerModule {}
