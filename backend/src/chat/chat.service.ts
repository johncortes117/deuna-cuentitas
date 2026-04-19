import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentService, type MessageRecord } from './agent.service';

// ─── Quick replies predefinidos ──────────────────────────────────
// El frontend puede enviar un `actionId` en lugar de texto libre.
// Esto permite botones de acceso rápido sin que el LLM deba interpretar
// el ID — se resuelve antes de llegar al agente.
const QUICK_REPLY_MAP: Record<string, string> = {
  DAILY_SUMMARY: '¿Cuánto he vendido hoy?',
  WEEKLY_TREND:  '¿Cómo fueron los últimos 7 días?',
  TOP_CLIENTS:   '¿Quiénes son mis mejores clientes este mes?',
  PEAK_HOURS:    '¿A qué hora vendo más?',
  TEAM_RANKING:  '¿Cómo va mi equipo este mes?',
  INACTIVE:      '¿Qué clientes no han vuelto en los últimos 14 días?',
  COMPARE_WEEKS: '¿Cómo fue esta semana comparado con la semana pasada?',
  BEST_DAY:      '¿Cuál fue mi mejor día de ventas?',
  GENERAL:       'Dame un resumen general de mi negocio.',
};

const MAX_MESSAGES_PER_SESSION = 100;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentService: AgentService,
  ) {}

  // ─── Iniciar sesión ──────────────────────────────────────────────

  async startSession(commerceId: string, role: string) {
    const session = await this.prisma.chatSession.create({
      data: { commerceId, role },
    });

    this.logger.log(`Session started: ${session.id} — commerce: ${commerceId}`);

    return {
      sessionId: session.id,
      welcomeMessage:
        'Soy tu asistente de Deuna Negocios. ¿En qué te ayudo?',
      quickReplies: [
        { id: 'DAILY_SUMMARY', label: '¿Cómo voy hoy?' },
        { id: 'WEEKLY_TREND',  label: 'Últimos 7 días' },
        { id: 'TOP_CLIENTS',   label: 'Mis mejores clientes' },
        { id: 'PEAK_HOURS',    label: 'Mi hora pico' },
      ],
    };
  }

  // ─── Procesar mensaje ────────────────────────────────────────────

  async processMessage(
    sessionId: string,
    text?: string,
    actionId?: string,
  ) {
    // 1. Validar sesión y obtener contexto del comercio
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');

    // 2. Límite de mensajes por sesión (prevención de abuso)
    const msgCount = await this.prisma.chatMessage.count({
      where: { sessionId },
    });
    if (msgCount >= MAX_MESSAGES_PER_SESSION) {
      return {
        id: 'limit',
        sender: 'bot',
        text: 'Has llegado al límite de mensajes de esta sesión. Inicia una nueva para continuar.',
        createdAt: new Date(),
      };
    }

    // 3. Resolver el texto de entrada (mensaje libre o quick reply)
    const userInput = this.resolveInput(text, actionId);

    // 4. Persistir mensaje del usuario
    await this.prisma.chatMessage.create({
      data: {
        sessionId,
        sender: 'user',
        text: userInput,
        actionId: actionId ?? null,
      },
    });

    // 5. Cargar historial reciente para contexto del agente
    const history: MessageRecord[] = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { sender: true, text: true },
    });

    // 6. Invocar el agente ReAct
    this.logger.log(`Invoking agent — session: ${sessionId}`);
    const { text: responseText, suggestions } = await this.agentService.run({
      commerceId: session.commerceId,
      role: session.role,
      userMessage: userInput,
      history,
    });

    // 7. Persistir respuesta del bot
    const botMessage = await this.prisma.chatMessage.create({
      data: { sessionId, sender: 'bot', text: responseText },
    });

    return {
      id: botMessage.id,
      sender: 'bot' as const,
      text: botMessage.text,
      createdAt: botMessage.createdAt,
      quickReplies: suggestions.map((s, i) => ({ id: `sug_${i}_${Date.now()}`, label: s })),
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private resolveInput(text?: string, actionId?: string): string {
    if (text?.trim()) return text.trim();
    if (actionId) return QUICK_REPLY_MAP[actionId] ?? `Acción: ${actionId}`;
    return 'Hola';
  }
}
