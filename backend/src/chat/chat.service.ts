import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NlpService } from './nlp.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nlpService: NlpService
  ) {}

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

    // 2. Lógica NLP Real (con fallback a Mock interno)
    // Recuperamos la sesión para saber quién es el comercio actual
    const session = await this.prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new Error('Sesión no encontrada');
    }

    let responseText = '';
    if (actionId) {
      responseText = `Recibí tu pulsación del botón (${actionId}), pero mi lógica de botones exacta aún se está desarrollando.`;
    } else {
      responseText = await this.nlpService.generateResponse(session.commerceId, text || '');
    }

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
