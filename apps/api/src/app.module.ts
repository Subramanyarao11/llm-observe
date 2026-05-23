import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ThrottlerModule } from "@nestjs/throttler";
import { BullBoardModule } from "@bull-board/nestjs";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter as BullBoardFastifyAdapter } from "@bull-board/fastify";
import { PrismaModule } from "@llm-observe/db";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AdminModule } from "./admin/admin.module";
import { ChatModule } from "./chat/chat.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { EventsModule } from "./events/events.module";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { ChatThrottlerGuard, IngestThrottlerGuard } from "./common/throttler.guards";
import { IngestModule } from "./ingest/ingest.module";

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
    EventsModule,
    BullModule.forRoot({
      connection: parseRedisUrl(
        process.env.REDIS_URL ?? "redis://localhost:6379",
      ),
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: "chat", ttl: 60_000, limit: 30 },
        { name: "ingest", ttl: 60_000, limit: 120 },
      ],
    }),
    BullModule.registerQueue({ name: "inference-logs" }),
    BullBoardModule.forRoot({
      route: "/admin/queues",
      adapter: BullBoardFastifyAdapter,
    }),
    BullBoardModule.forFeature({
      name: "inference-logs",
      adapter: BullMQAdapter as never,
    }),
    IngestModule,
    ConversationsModule,
    ChatModule,
    AnalyticsModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [HealthService, ChatThrottlerGuard, IngestThrottlerGuard],
})
export class AppModule {}
