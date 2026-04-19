import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  async startSession(commerceId: string, role: string) {
    const session = await this.prisma.chatSession.create({
      data: {
        commerceId,
        role,
      },
    });
    this.logger.log(`Session started: ${session.id}`);
    
    // Aquí devolveríamos un JWT en etapas de Seguridad, por ahora el sessionId es el token de acceso básico.
    return {
      sessionId: session.id,
      welcomeMessage: "¡Hola! Soy tu asistente de Deuna Negocios. ¿En qué te puedo ayudar hoy?",
    };
  }

  async processMessage(sessionId: string, text?: string, actionId?: string) {
    // 1. Guardar mensaje del usuario
    await this.prisma.chatMessage.create({
      data: {
        sessionId,
        sender: 'user',
        text: text || null,
        actionId: actionId || null,
      },
    });

    // 2. Lógica NLP simulada (Mock)
    const responseText = actionId 
        ? `Recibí tu pulsación del botón (${actionId}), pero mi lógica conversacional exacta aún se está desarrollando.`
        : `Leí tu mensaje: "${text}". Aún estoy aprendiendo, por lo que esta es una respuesta automática del backend.`;

    // 3. Guardar respuesta del bot en BD
    const botMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        sender: 'bot',
        text: responseText,
      },
    });

    return {
      id: botMessage.id,
      sender: 'bot',
      text: botMessage.text,
      createdAt: botMessage.createdAt,
    };
  }
}
