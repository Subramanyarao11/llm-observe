import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "@llm-observe/db";
import { redactPII } from "@llm-observe/pii";
import { CreateConversationDto, ListConversationsDto } from "../dto";

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(dto: CreateConversationDto) {
    const conversation = await this.prisma.conversation.create({
      data: {
        provider: dto.provider,
        model: dto.model,
        title: dto.title ?? null,
      },
    });
    this.events.emit("conversation.created", {
      conversationId: conversation.id,
      provider: conversation.provider,
      model: conversation.model,
    });
    return conversation;
  }

  async list(query: ListConversationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.provider ? { provider: query.provider } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  async getWithMessages(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!conversation) throw new NotFoundException("Conversation not found");
    return conversation;
  }

  async updateStatus(id: string, status: string) {
    const conversation = await this.prisma.conversation.update({
      where: { id },
      data: { status },
    });
    if (status === "cancelled") {
      this.events.emit("conversation.cancelled", { conversationId: id });
    }
    return conversation;
  }

  async resume(id: string) {
    const conversation = await this.prisma.conversation.update({
      where: { id },
      data: { status: "active" },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    this.events.emit("conversation.resumed", { conversationId: id });
    return conversation;
  }

  async addMessage(conversationId: string, role: string, content: string) {
    const { redacted } = redactPII(content);
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role,
        content: redacted,
      },
    });

    const updateData: { updatedAt: Date; title?: string } = {
      updatedAt: new Date(),
    };

    if (role === "user") {
      const [conversation, userMessageCount] = await Promise.all([
        this.prisma.conversation.findUnique({ where: { id: conversationId } }),
        this.prisma.message.count({
          where: { conversationId, role: "user" },
        }),
      ]);

      if (conversation && !conversation.title && userMessageCount === 1) {
        updateData.title = redacted.replace(/\s+/g, " ").trim().slice(0, 50);
      }
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });
    return message;
  }

  async getInferenceLogs(conversationId: string) {
    return this.prisma.inferenceLog.findMany({
      where: { conversationId },
      orderBy: { requestStartedAt: "asc" },
      select: {
        id: true,
        latencyMs: true,
        ttftMs: true,
        totalTokens: true,
        promptTokens: true,
        completionTokens: true,
        status: true,
        requestStartedAt: true,
      },
    });
  }
}
