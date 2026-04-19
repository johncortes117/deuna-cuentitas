import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { AnalyticsService } from '../analytics/analytics.service';
import { buildSystemPrompt } from './agent.prompts';

// ─── Tipos públicos ──────────────────────────────────────────────

/** Representa un mensaje del hilo ya cargado desde Prisma. */
export interface MessageRecord {
  sender: string;
  text: string | null;
}

export interface AgentRunParams {
  commerceId: string;
  role: string;
  userMessage: string;
  /** Últimos N mensajes del hilo, ya cargados desde Prisma */
  history: MessageRecord[];
}

// ─── Constantes ─────────────────────────────────────────────────

const HISTORY_WINDOW = 20; // mensajes de contexto máximos enviados al LLM
const FALLBACK_MSG =
  'Lo siento, tuve un problema procesando tu consulta. ¿Puedes intentarlo de nuevo?';

// ─── Servicio ───────────────────────────────────────────────────

/**
 * AgentService — orquesta el agente ReAct de LangGraph.
 *
 * Por cada llamada a `run()`:
 *  1. Construye un conjunto de tools donde `commerceId` está
 *     cerrado en el closure — el LLM nunca puede cambiarlo.
 *  2. Crea un grafo ReAct con `createReactAgent`.
 *  3. Invoca el grafo con el historial de mensajes convertido a
 *     mensajes de LangChain.
 *  4. Extrae y devuelve el texto final del último mensaje del agente.
 *
 * El modelo LLM (ChatAnthropic) es un singleton inicializado una vez
 * en el constructor. Los grafos se crean por-request (son ligeros).
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly llm: ChatOpenAI;

  constructor(private readonly analytics: AnalyticsService) {
    this.llm = new ChatOpenAI({
      model: 'gpt-4o',
      apiKey: process.env.OPENAI_API_KEY,
      temperature: 0.2,
      maxTokens: 1024,
    });
  }

  // ─── Punto de entrada público ────────────────────────────────────

  async run(params: AgentRunParams): Promise<string> {
    const { commerceId, role, userMessage, history } = params;

    try {
      const tools = this.buildTools(commerceId);

      // createReactAgent devuelve un CompiledGraph reutilizable;
      // para esta demo lo creamos por-request para simplicidad.
      const agent = createReactAgent({
        llm: this.llm,
        tools,
        // stateModifier inyecta el SystemMessage antes de todos los mensajes
        stateModifier: buildSystemPrompt({ commerceId, role }),
      });

      const messages = [
        ...this.mapHistory(history),
        new HumanMessage(userMessage),
      ];

      this.logger.log(
        `Agent run — commerce: ${commerceId} | msg: "${userMessage.slice(0, 60)}"`,
      );

      const result = await agent.invoke({ messages });

      return this.extractText(result.messages.at(-1)?.content);
    } catch (error) {
      this.logger.error('AgentService.run failed', error);
      return FALLBACK_MSG;
    }
  }

  // ─── Tools ──────────────────────────────────────────────────────

  /**
   * Construye las tools con `commerceId` cerrado en el closure.
   * El LLM solo ve los schemas Zod y las descripciones — nunca el ID real.
   */
  private buildTools(commerceId: string) {
    const a = this.analytics;

    const getDailySummary = tool(
      async ({ date }) =>
        JSON.stringify(a.getDailySummary(commerceId, date ?? undefined)),
      {
        name: 'get_daily_summary',
        description:
          'Resumen de ventas de un día concreto: total recaudado, número de cobros y ticket promedio. ' +
          'Úsala para preguntas sobre hoy, ayer o una fecha específica.',
        schema: z.object({
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .describe('Fecha exacta en formato YYYY-MM-DD (ej: 2026-03-15). Omitir este campo para consultar hoy.'),
        }),
      },
    );

    const getWeeklyTrend = tool(
      async ({ days }) => JSON.stringify(a.getWeeklyTrend(commerceId, days)),
      {
        name: 'get_weekly_trend',
        description:
          'Ventas día a día de los últimos N días. Para identificar tendencias, ' +
          'mejores días de la semana o evolución reciente.',
        schema: z.object({
          days: z
            .number()
            .int()
            .min(1)
            .max(90)
            .default(7)
            .describe('Días hacia atrás (7, 14 o 30 son los más usados).'),
        }),
      },
    );

    const getPeakHours = tool(
      async ({ period }) => JSON.stringify(a.getPeakHours(commerceId, period)),
      {
        name: 'get_peak_hours',
        description:
          'Top franjas horarias con más cobros. ' +
          'Úsala cuando el usuario pregunte a qué hora vende más o cuál es su hora más movida.',
        schema: z.object({
          period: z
            .enum(['today', 'week', 'month'])
            .default('month')
            .describe('Período a analizar.'),
        }),
      },
    );

    const getTopClients = tool(
      async ({ period, limit }) =>
        JSON.stringify(a.getTopClients(commerceId, period, limit)),
      {
        name: 'get_top_clients',
        description:
          'Mejores clientes por monto total gastado: nombre, visitas y total. ' +
          'Para preguntas de ranking de clientes o fidelidad.',
        schema: z.object({
          period: z
            .enum(['today', 'week', 'month', 'year'])
            .default('month')
            .describe('Período de análisis.'),
          limit: z
            .number()
            .int()
            .min(1)
            .max(10)
            .default(3)
            .describe('Cuántos clientes mostrar.'),
        }),
      },
    );

    const getTopVendors = tool(
      async ({ period }) => JSON.stringify(a.getTopVendors(commerceId, period)),
      {
        name: 'get_top_vendors',
        description:
          'Rendimiento de vendedores del negocio: total vendido y transacciones. ' +
          'Solo es útil si el negocio tiene más de un vendedor.',
        schema: z.object({
          period: z
            .enum(['today', 'week', 'month'])
            .default('month')
            .describe('Período de análisis.'),
        }),
      },
    );

    const getInactiveClients = tool(
      async ({ days_since }) =>
        JSON.stringify(a.getInactiveClients(commerceId, days_since)),
      {
        name: 'get_inactive_clients',
        description:
          'Clientes que no han comprado en los últimos X días. ' +
          'Para preguntas sobre clientes perdidos, retención o a quién reconquistar.',
        schema: z.object({
          days_since: z
            .number()
            .int()
            .min(7)
            .max(365)
            .default(14)
            .describe('Días sin visita para considerar al cliente inactivo.'),
        }),
      },
    );

    const compareWeeks = tool(
      async () => JSON.stringify(a.compareWeeks(commerceId)),
      {
        name: 'compare_weeks',
        description:
          'Compara esta semana con la semana anterior: ingresos totales y número de cobros.',
        schema: z.object({}),
      },
    );

    const getBestDay = tool(
      async () => JSON.stringify(a.getBestDay(commerceId)),
      {
        name: 'get_best_day',
        description:
          'El mejor día de ventas en toda la historia del negocio: fecha, cobros y total.',
        schema: z.object({}),
      },
    );

    const getGeneralSummary = tool(
      async () => JSON.stringify(a.getGeneralSummary(commerceId)),
      {
        name: 'get_general_summary',
        description:
          'Resumen histórico completo: ventas totales, ticket promedio, primera y última venta. ' +
          'Úsala cuando el usuario pida un resumen general o histórico.',
        schema: z.object({}),
      },
    );

    return [
      getDailySummary,
      getWeeklyTrend,
      getPeakHours,
      getTopClients,
      getTopVendors,
      getInactiveClients,
      compareWeeks,
      getBestDay,
      getGeneralSummary,
    ];
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  /** Convierte el historial de Prisma a mensajes de LangChain (ventana acotada). */
  private mapHistory(
    history: MessageRecord[],
  ): (HumanMessage | AIMessage)[] {
    return history
      .filter((m) => m.text)
      .slice(-HISTORY_WINDOW)
      .map((m) =>
        m.sender === 'user'
          ? new HumanMessage(m.text!)
          : new AIMessage(m.text!),
      );
  }

  /** Extrae texto del content del último mensaje (string o array de bloques). */
  private extractText(content: unknown): string {
    if (!content) return FALLBACK_MSG;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      const block = content.find(
        (b): b is { type: 'text'; text: string } =>
          typeof b === 'object' && b !== null && (b as any).type === 'text',
      );
      return block?.text ?? FALLBACK_MSG;
    }
    return FALLBACK_MSG;
  }
}
