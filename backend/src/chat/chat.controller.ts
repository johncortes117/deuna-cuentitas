import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('session/start')
  async startSession(@Body() body: { commerceId: string; role: string }) {
    return this.chatService.startSession(body.commerceId, body.role);
  }

  @Post('message')
  async handleMessage(
    @Body() body: { sessionId: string; text?: string; actionId?: string },
  ) {
    return this.chatService.processMessage(body.sessionId, body.text, body.actionId);
  }
}
