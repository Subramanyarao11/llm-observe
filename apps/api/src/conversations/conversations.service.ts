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
        title: dto.title ?? `New ${dto.provider} chat`,
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

    return { items, total, page, limit };
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
    return this.prisma.message.create({
      data: {
        conversationId,
        role,
        content: redacted,
      },
    });
  }
}
