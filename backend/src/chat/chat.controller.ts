import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { StartSessionDto, SendMessageDto } from './chat.dto';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('session/start')
  @ApiOperation({ summary: 'Inicia una nueva sesión de chat con el bot.' })
  @ApiResponse({ status: 201, description: 'La sesión fue creada exitosamente, devuelve un welcomeMessage.' })
  async startSession(@Body() body: StartSessionDto) {
    return this.chatService.startSession(body.commerceId, body.role);
  }

  @Post('message')
  @ApiOperation({ summary: 'Envía un mensaje al bot y recibe una respuesta basada en RAG.' })
  @ApiResponse({ status: 201, description: 'El mensaje de respuesta generado o simulado por el bot.' })
  async handleMessage(@Body() body: SendMessageDto) {
    return this.chatService.processMessage(body.sessionId, body.text, body.actionId);
  }
}

