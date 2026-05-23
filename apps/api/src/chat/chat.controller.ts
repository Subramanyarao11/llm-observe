import { Body, Controller, MessageEvent, Post, Query, Sse, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Observable, Subject } from "rxjs";
import { ChatThrottlerGuard } from "../common/throttler.guards";
import { ChatService } from "./chat.service";
import { ChatDto, StreamQueryDto } from "../dto";

@Controller("chat")
@UseGuards(ChatThrottlerGuard)
@Throttle({ chat: { limit: 30, ttl: 60_000 } })
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() dto: ChatDto) {
    return this.chatService.chat(dto);
  }

  @Sse("stream")
  stream(@Query() dto: StreamQueryDto): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    this.chatService.stream(dto, subject as Subject<{ data: string }>);
    return subject.asObservable();
  }
}
