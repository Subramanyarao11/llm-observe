import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { withSpan } from "@llm-observe/telemetry";
import { LLMClient } from "@llm-observe/sdk";
import { Subject } from "rxjs";
import { ConversationsService } from "../conversations/conversations.service";
import { ChatDto, StreamQueryDto } from "../dto";

@Injectable()
export class ChatService {
  constructor(
    private readonly llm: LLMClient,
    private readonly events: EventEmitter2,
    private readonly conversationsService: ConversationsService,
  ) {}

  async chat(dto: ChatDto) {
    const conversation = await this.conversationsService.getWithMessages(
      dto.conversationId,
    );
    if (conversation.status === "cancelled") {
      throw new Error("Conversation is cancelled");
    }

    await this.conversationsService.addMessage(
      dto.conversationId,
      "user",
      dto.content,
    );
    this.events.emit("conversation.message_sent", {
      conversationId: dto.conversationId,
      role: "user",
    });

    const messages = [
      ...conversation.messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      { role: "user" as const, content: dto.content },
    ];

    const response = await withSpan(
      "chat.completion",
      {
        "conversation.id": dto.conversationId,
        "session.id": dto.sessionId,
        "llm.provider": dto.provider,
        "llm.model": dto.model,
      },
      () =>
        this.llm.chat({
          provider: dto.provider,
          model: dto.model,
          messages,
          conversationId: dto.conversationId,
          sessionId: dto.sessionId,
        }),
    );

    await this.conversationsService.addMessage(
      dto.conversationId,
      "assistant",
      response,
    );
    this.events.emit("conversation.message_sent", {
      conversationId: dto.conversationId,
      role: "assistant",
    });

    return { content: response };
  }

  async stream(dto: StreamQueryDto, subject: Subject<{ data: string }>) {
    const conversation = await this.conversationsService.getWithMessages(
      dto.conversationId,
    );

    await this.conversationsService.addMessage(
      dto.conversationId,
      "user",
      dto.content,
    );
    this.events.emit("conversation.message_sent", {
      conversationId: dto.conversationId,
      role: "user",
    });

    const messages = [
      ...conversation.messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      { role: "user" as const, content: dto.content },
    ];

    let fullResponse = "";
    try {
      await withSpan(
        "chat.stream",
        {
          "conversation.id": dto.conversationId,
          "session.id": dto.sessionId,
          "llm.provider": dto.provider,
          "llm.model": dto.model,
        },
        async () => {
          for await (const chunk of this.llm.stream({
            provider: dto.provider,
            model: dto.model,
            messages,
            conversationId: dto.conversationId,
            sessionId: dto.sessionId,
          })) {
            fullResponse += chunk;
            subject.next({ data: JSON.stringify({ chunk }) });
          }
        },
      );
      subject.next({ data: JSON.stringify({ done: true }) });

      await this.conversationsService.addMessage(
        dto.conversationId,
        "assistant",
        fullResponse,
      );
      this.events.emit("conversation.message_sent", {
        conversationId: dto.conversationId,
        role: "assistant",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Stream failed";
      subject.next({ data: JSON.stringify({ error: true, message }) });
    } finally {
      subject.complete();
    }
  }
}
