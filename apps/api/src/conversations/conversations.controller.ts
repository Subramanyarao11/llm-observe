import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { CreateConversationDto, ListConversationsDto } from "../dto";

@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  list(@Query() query: ListConversationsDto) {
    return this.conversationsService.list(query);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.conversationsService.getWithMessages(id);
  }

  @Patch(":id/cancel")
  cancel(@Param("id") id: string) {
    return this.conversationsService.updateStatus(id, "cancelled");
  }

  @Post(":id/resume")
  resume(@Param("id") id: string) {
    return this.conversationsService.resume(id);
  }

  @Post()
  create(@Body() dto: CreateConversationDto) {
    return this.conversationsService.create(dto);
  }
}
