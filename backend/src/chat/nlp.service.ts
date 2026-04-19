import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { DbService } from '../db/db.service';

@Injectable()
export class NlpService {
  private readonly logger = new Logger(NlpService.name);
  private openai: OpenAI;

  constructor(private readonly dbService: DbService) {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      this.logger.log('OpenAI inicializado exitosamente.');
    } else {
      this.logger.warn('OPENAI_API_KEY no detectada en .env. Se usará modo simulado (Mock).');
    }
  }

  private detectIntent(text: string): { intent: string; sql: string; title: string } | null {
    const intents: { keywords: string[]; intent: string; sql: string; title: string }[] = [
      {
        keywords: ['vendedor', 'vendedores', 'mejor vendedor', 'peor vendedor', 'ranking vendedor', 'equipo'],
        intent: 'vendedores',
        sql: `SELECT vendor_name, COUNT(*) as txns, ROUND(SUM(amount),2) as total
              FROM transactions
              WHERE business_id=? AND vendor_id!=''
              GROUP BY vendor_id ORDER BY total DESC`,
        title: 'Ranking de Vendedores',
      },
      {
        keywords: ['hoy', 'vendi hoy', 'cuanto vendi', 'ventas de hoy', 'dia de hoy', 'cobros hoy'],
        intent: 'resumen_hoy',
        sql: `SELECT COUNT(*) as cobros, ROUND(SUM(amount),2) as total
              FROM transactions
              WHERE business_id=? AND date=date('now')`,
        title: 'Resumen de Ventas de Hoy',
      },
      {
        keywords: ['ayer', 'vendi ayer', 'ventas de ayer', 'cobros ayer'],
        intent: 'resumen_ayer',
        sql: `SELECT COUNT(*) as cobros, ROUND(SUM(amount),2) as total
              FROM transactions
              WHERE business_id=? AND date=date('now','-1 day')`,
        title: 'Resumen de Ventas de Ayer',
      },
      {
        keywords: ['semana', 'esta semana', 'semanal', 'ultimos 7 dias'],
        intent: 'resumen_semana',
        sql: `SELECT COUNT(*) as cobros, ROUND(SUM(amount),2) as total
              FROM transactions
              WHERE business_id=? AND date >= date('now','-7 days')`,
        title: 'Resumen Semanal (Últimos 7 días)',
      },
      {
        keywords: ['mes', 'este mes', 'mensual', 'ventas del mes'],
        intent: 'resumen_mes',
        sql: `SELECT COUNT(*) as cobros, ROUND(SUM(amount),2) as total
              FROM transactions
              WHERE business_id=? AND date >= date('now','-30 days')`,
        title: 'Resumen del Mes (Últimos 30 días)',
      },
      {
        keywords: ['resumen', 'historico', 'total de ventas', 'cuanto he vendido', 'general', 'todas las ventas'],
        intent: 'resumen_general',
        sql: `SELECT COUNT(*) as cobros, ROUND(SUM(amount),2) as total,
              ROUND(AVG(amount),2) as ticket_promedio,
              MIN(date) as primera_venta, MAX(date) as ultima_venta
              FROM transactions
              WHERE business_id=?`,
        title: 'Resumen General Histórico',
      },
      {
        keywords: ['hora pico', 'hora lleno', 'mas movimiento', 'mas ocupado', 'hora fuerte', 'hora mejor'],
        intent: 'hora_pico',
        sql: `SELECT hour, COUNT(*) as txns
              FROM transactions
              WHERE business_id=?
              GROUP BY hour ORDER BY txns DESC LIMIT 3`,
        title: 'Horas Pico (Top 3)',
      },
      {
        keywords: ['cliente', 'clientes', 'fiel', 'fieles', 'ranking cliente', 'mejor cliente', 'frecuentes'],
        intent: 'clientes',
        sql: `SELECT client_name, COUNT(*) as visitas, ROUND(SUM(amount),2) as total
              FROM transactions
              WHERE business_id=?
              GROUP BY client_id ORDER BY total DESC LIMIT 5`,
        title: 'Top 5 Clientes (por monto)',
      },
      {
        keywords: ['no vuelto', 'perdidos', 'inactivos', 'dejaron de venir', 'no han regresado'],
        intent: 'clientes_perdidos',
        sql: `SELECT client_name, MAX(date) as ultima_visita
              FROM transactions
              WHERE business_id=?
              GROUP BY client_id
              HAVING ultima_visita < date('now','-14 days')
              ORDER BY ultima_visita ASC LIMIT 5`,
        title: 'Clientes que no han vuelto (>14 días)',
      },
      {
        keywords: ['comparar', 'comparacion', 'vs', 'semana pasada', 'semana anterior'],
        intent: 'comparacion_semanal',
        sql: `SELECT
              ROUND(SUM(CASE WHEN date >= date('now','-7 days') THEN amount ELSE 0 END),2) as esta_semana,
              ROUND(SUM(CASE WHEN date >= date('now','-14 days') AND date < date('now','-7 days') THEN amount ELSE 0 END),2) as semana_pasada
              FROM transactions WHERE business_id=?`,
        title: 'Comparación Semanal',
      },
      {
        keywords: ['dia mejor', 'mejor dia', 'dia mas vendi', 'dia record'],
        intent: 'mejor_dia',
        sql: `SELECT date, COUNT(*) as cobros, ROUND(SUM(amount),2) as total
              FROM transactions
              WHERE business_id=?
              GROUP BY date ORDER BY total DESC LIMIT 1`,
        title: 'Tu Mejor Día de Ventas',
      },
    ];

    // Buscar la intención que más keywords coincidas tienen
    let bestMatch: { intent: string; sql: string; title: string } | null = null;
    let bestScore = 0;

    for (const entry of intents) {
      let score = 0;
      for (const kw of entry.keywords) {
        if (text.includes(kw)) {
          // Dar mayor peso a keywords más largos (más específicos)
          score += kw.length;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { intent: entry.intent, sql: entry.sql, title: entry.title };
      }
    }

    return bestMatch;
  }

  async generateResponse(commerceId: string, userMessage: string): Promise<string> {
    const text = userMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 1. Detectar intención
    const detected = this.detectIntent(text);

    let rawData = null;
    let contextTitle = '';

    // 2. Extracción de RAG desde SQLite
    if (detected) {
      try {
        rawData = this.dbService.rawQuery(detected.sql, [commerceId]);
        contextTitle = detected.title;
        this.logger.log(`Intent detectado: ${detected.intent} — ${rawData.length} filas extraídas.`);
      } catch (err) {
        this.logger.error(`Error sacando data de SQLite para intent "${detected.intent}"`, err);
        return 'Tengo un problema leyendo los libros de cuentas ahora mismo. Intenta de nuevo.';
      }
    }

    // 3. Generación Asistida o Mock fallback
    if (!this.openai) {
      if (rawData) {
        return `[MODO MOCK SIN OPENAI]\nIntención: "${contextTitle}".\nDatos:\n${JSON.stringify(rawData, null, 2)}`;
      }
      return `[MODO MOCK] No identifiqué intención para: "${userMessage}". Agrega tu OPENAI_API_KEY en .env.`;
    }

    // 4. Inyección a GPT-4o
    try {
      let dataPrompt: string;

      if (rawData && rawData.length > 0) {
        // Revisar si los datos tienen valores nulos (ej. no hay ventas hoy)
        const firstRow = rawData[0];
        const hasNullValues = Object.values(firstRow).some(v => v === null || v === 0);

        if (hasNullValues && rawData.length === 1) {
          dataPrompt = `El sistema buscó "${contextTitle}" para este negocio pero no encontró registros que coincidan con ese período. 
            Datos devueltos: ${JSON.stringify(rawData)}.
            Comunica amablemente que no hay datos para ese período y sugiere que pruebe con otro rango.`;
        } else {
          dataPrompt = `El sistema extrajo datos REALES de la DDBB para "${contextTitle}": ${JSON.stringify(rawData)}
            Tu respuesta DEBE basarse 100% en estos números. Usa lenguaje natural, destaca insights, y felicita si le va bien.
            Formatea cantidades como moneda ($X.XX). Usa emojis pertinentes pero con moderación.`;
        }
      } else {
        dataPrompt = `No se encontró una intención estructurada para esta pregunta. Responde como asistente general de Deuna Negocios.
          Si el usuario pregunta algo sobre sus datos de ventas, infórmale que puede preguntar cosas como:
          - "¿Cuánto vendí hoy/ayer/esta semana?"
          - "¿Quién es mi mejor vendedor?"
          - "¿Cuáles son mis clientes más fieles?"
          - "¿A qué hora tengo más movimiento?"
          - "¿Cuál fue mi mejor día de ventas?"`;
      }

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Eres el Asistente IA de Deuna Negocios, una fintech de pagos QR de Ecuador.
            Tu nombre es "Asistente Deuna". Hablas en español informal pero profesional.
            El negocio actual tiene ID: ${commerceId}.
            Responde de forma concisa (máximo 3-4 oraciones), clara y amigable.
            NUNCA inventes datos. Solo usa la información que el sistema te proporcione.
            Si no tienes datos, guía al usuario sobre qué puede preguntar.
            \n${dataPrompt}`
          },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      return response.choices[0].message.content || 'Lo siento, no pude formular una respuesta.';
    } catch (e: any) {
      this.logger.error('OpenAI Error', e?.message || e);
      return 'Lo siento, mi conexión con el servidor de IA no responde. Intenta de nuevo en unos segundos.';
    }
  }
}
