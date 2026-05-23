import { Body, Controller, MessageEvent, Post, Query, Sse } from "@nestjs/common";
import { Observable, Subject } from "rxjs";
import { ChatService } from "./chat.service";
import { ChatDto, StreamQueryDto } from "../dto";

@Controller("chat")
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
