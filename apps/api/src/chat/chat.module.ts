import { Module } from "@nestjs/common";
import { LLMClient } from "@llm-observe/sdk";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { ConversationsModule } from "../conversations/conversations.module";

@Module({
  imports: [ConversationsModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    {
      provide: LLMClient,
      useFactory: () =>
        new LLMClient({
          ingestUrl:
            process.env.INGEST_URL ??
            `http://localhost:${process.env.PORT ?? 3001}/api`,
          openaiApiKey: process.env.OPENAI_API_KEY,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
          geminiApiKey: process.env.GEMINI_API_KEY,
        }),
    },
  ],
})
export class ChatModule {}
