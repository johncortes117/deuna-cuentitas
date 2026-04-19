import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { InsightEvent } from './types/insight-event.interface';

const SYSTEM_CONTEXT = `Eres el asistente de Cuentitas, una app financiera para negocios en Ecuador.
Escribe UN mensaje de WhatsApp muy corto (máximo 2 líneas + 1 emoji).
Reglas estrictas:
- Tuteo siempre ("¡Rompiste!", nunca "usted")
- Dólares como "$94", nunca "94 USD"
- Sin jerga financiera (sin KPI, ROI, métricas)
- Positivo y directo; si es alerta, sugiere UNA acción concreta
- No inventes datos que no estén en el JSON`;

const FALLBACKS: Record<string, string> = {
  daily_record: '🏆 ¡Récord del día! Abre la app para ver los detalles.',
  slow_start: '☕ Mañana tranquila. Considera activar alguna promoción hoy.',
  returning_client: '👋 ¡Un cliente volvió! Revisa la app para ver quién fue.',
  day_closing: '📊 ¡Así cerró tu día! Abre Cuentitas para ver el resumen completo.',
};

@Injectable()
export class InsightFormatterService {
  private readonly logger = new Logger(InsightFormatterService.name);
  private readonly llm: ChatOpenAI;

  constructor() {
    this.llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY,
      temperature: 0.7,
      maxTokens: 150,
    });
  }

  async format(event: InsightEvent): Promise<string> {
    const prompt = this.buildPrompt(event);
    try {
      const response = await this.llm.invoke([new HumanMessage(prompt)]);
      const text = this.extractText(response.content);
      return text || this.fallback(event.ruleId);
    } catch (error) {
      this.logger.error(`Formatter failed for rule "${event.ruleId}"`, error);
      return this.fallback(event.ruleId);
    }
  }

  private buildPrompt(event: InsightEvent): string {
    return `${SYSTEM_CONTEXT}

Tipo de insight: ${event.ruleId}
Datos: ${JSON.stringify(event.data, null, 2)}

Mensaje WhatsApp:`;
  }

  private fallback(ruleId: string): string {
    return FALLBACKS[ruleId] ?? '📱 Tienes un nuevo insight en la app de Cuentitas.';
  }

  private extractText(content: unknown): string {
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
      const block = content.find(
        (b): b is { type: 'text'; text: string } =>
          typeof b === 'object' && b !== null && (b as any).type === 'text',
      );
      return block?.text?.trim() ?? '';
    }
    return '';
  }
}
