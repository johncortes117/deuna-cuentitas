# Arquitectura del Agente IA — Cuentitas / Deuna Negocios

**Versión:** 1.0  
**Fecha:** Abril 2026  
**Audiencia:** Equipo de ingeniería

---

## 1. Estado actual

El chatbot existe como UI funcional (`ChatbotView.tsx`) y el backend tiene la sesión/persistencia de mensajes (`ChatService`), pero el core del agente es un stub que devuelve el mensaje del usuario con eco:

```typescript
// backend/src/chat/chat.service.ts — estado actual
const responseText = `Leí tu mensaje: "${text}". Aún estoy aprendiendo…`;
```

La infraestructura base ya existe y es correcta:

| Pieza | Estado | Uso actual |
|---|---|---|
| `POST /chat/session/start` | ✅ Funcional | Crea sesión con commerceId + role |
| `POST /chat/message` | ✅ Funcional | Recibe mensaje, devuelve stub |
| `ChatSession` / `ChatMessage` (Prisma) | ✅ Funcional | Persiste historial |
| Redis | ✅ Configurado | Sin uso aún |
| Dataset SQLite + CSV | ✅ Disponible | Sin conectar al agente |

Lo que hay que construir es la capa de inteligencia entre el mensaje del usuario y la respuesta del bot.

---

## 2. Principios de diseño

### 2.1 El agente no toca la DB directamente

El LLM nunca ejecuta SQL ni tiene acceso directo a Prisma. Solo puede invocar herramientas (tools) predefinidas que son funciones tipadas en el backend. Estas funciones:

- Están **acotadas por `commerceId`** — sin posibilidad de override
- Devuelven **datos agregados**, no filas raw
- Tienen **límites de resultado** para prevenir exfiltración masiva

### 2.2 Queries dinámicas vía tool use

El usuario puede preguntar cosas arbitrarias: "¿Cuánto vendí este mes comparado con el anterior?", "¿Quién es mi cliente más fiel?", "¿Los lunes vendo más que los viernes?". El agente decide en tiempo real qué herramientas llamar y en qué orden para construir una respuesta completa. Una sola pregunta puede disparar 2-3 tool calls encadenadas.

### 2.3 Respuesta conversacional, no reporte

La respuesta final siempre pasa por el LLM — nunca se devuelve data cruda. El LLM traduce los datos al tono de Cuentitas: español neutro, tuteo, números en dólares, sin jerga financiera.

---

## 3. Arquitectura objetivo

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│                                                                 │
│  ChatbotView ──POST /chat/message──► (sessionId, text)         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND NESTJS                               │
│                                                                 │
│  ChatController                                                 │
│       │                                                         │
│       ▼                                                         │
│  ChatService ──────────────────────────────────────────────────┐│
│       │  1. Valida sesión (Prisma)                             ││
│       │  2. Carga historial de mensajes                        ││
│       │  3. Construye contexto de comercio                     ││
│       │  4. Delega a AgentService                              ││
│       │                                                        ││
│       ▼                                                        ││
│  AgentService ◄──────────────────────────────────────────────┐ ││
│       │  5. Llama Claude API (messages + tools)               │ ││
│       │  6. Si Claude responde con tool_use:                  │ ││
│       │     a. Ejecuta cada tool en AnalyticsService          │ ││
│       │     b. Agrega tool_results al hilo                    │ ││
│       │     c. Re-llama Claude ──────────────────────────────►│ ││
│       │  7. Cuando Claude responde con texto: devuelve        │ ││
│       │                                                        │ ││
│       ▼                                                        │ ││
│  AnalyticsService (internal, scoped by commerceId)            │ ││
│       │  Queries seguros sobre Prisma/DB                      │ ││
│       │  Sin exposición HTTP pública                          │ ││
│       │                                                        │ ││
│  Redis Cache ◄────────────────────────────────────────────────┘ ││
│       TTL corto para resultados de analytics                    ││
│                                                                 ││
│  8. Persiste mensaje usuario + respuesta bot (Prisma)          ││
│  9. Devuelve respuesta al frontend                             ││
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ANTHROPIC CLAUDE API                          │
│                                                                 │
│  Modelo: claude-haiku-4-5 (velocidad) o claude-sonnet-4-6      │
│  Modo: tool use (function calling)                              │
│  Max tool iterations: 5 por turno                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Módulos NestJS a construir

### 4.1 Estructura de módulos

```
AppModule
  ├── PrismaModule (global, ya existe)
  ├── RedisModule (ya existe)
  ├── ChatModule (refactorizar)
  │   ├── ChatController          ← ya existe, sin cambios
  │   ├── ChatService             ← refactorizar: delega a AgentService
  │   └── AgentService            ← nuevo: loop de Claude + tools
  └── AnalyticsModule             ← nuevo
      └── AnalyticsService        ← nuevo: queries seguros por commerceId
          (sin AnalyticsController — es interno)
```

### 4.2 `AgentService`

Responsabilidades:
- Mantener el loop agentico (enviar → recibir tool_use → ejecutar → re-enviar)
- Construir el system prompt con contexto del comercio
- Mapear tool calls de Claude a métodos de `AnalyticsService`
- Cortar el loop si se supera el máximo de iteraciones (safety)

```typescript
// backend/src/chat/agent.service.ts — estructura

@Injectable()
export class AgentService {
  private readonly MAX_TOOL_ITERATIONS = 5;

  constructor(
    private readonly analytics: AnalyticsService,
    private readonly redis: RedisService,
  ) {}

  async run(input: AgentInput): Promise<string> {
    const { commerceId, role, userMessage, conversationHistory } = input;

    const messages = this.buildMessages(conversationHistory, userMessage);
    const systemPrompt = this.buildSystemPrompt(commerceId, role);

    let iteration = 0;

    while (iteration < this.MAX_TOOL_ITERATIONS) {
      const response = await this.callClaude(systemPrompt, messages);

      if (response.stop_reason === 'end_turn') {
        return this.extractText(response);
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults = await this.executeTools(response.content, commerceId);
        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: toolResults });
        iteration++;
        continue;
      }

      break;
    }

    return 'Lo siento, no pude procesar tu consulta en este momento.';
  }

  private async executeTools(
    content: AnthropicContentBlock[],
    commerceId: string,
  ): Promise<ToolResultBlock[]> {
    const toolUses = content.filter(b => b.type === 'tool_use');

    // Ejecutar en paralelo cuando no hay dependencias entre tools
    const results = await Promise.all(
      toolUses.map(async (tool) => ({
        type: 'tool_result' as const,
        tool_use_id: tool.id,
        content: await this.dispatchTool(tool.name, tool.input, commerceId),
      })),
    );

    return results;
  }

  private async dispatchTool(
    name: string,
    input: Record<string, unknown>,
    commerceId: string,  // siempre inyectado desde la sesión, nunca del input del LLM
  ): Promise<string> {
    switch (name) {
      case 'get_daily_summary':
        return JSON.stringify(
          await this.analytics.getDailySummary(commerceId, input.date as string)
        );
      case 'get_weekly_trend':
        return JSON.stringify(
          await this.analytics.getWeeklyTrend(commerceId, input.days as number)
        );
      case 'get_peak_hours':
        return JSON.stringify(
          await this.analytics.getPeakHours(commerceId, input.period as string)
        );
      case 'get_top_clients':
        return JSON.stringify(
          await this.analytics.getTopClients(commerceId, input.period as string, input.limit as number)
        );
      case 'get_top_vendors':
        return JSON.stringify(
          await this.analytics.getTopVendors(commerceId, input.period as string)
        );
      case 'get_inactive_clients':
        return JSON.stringify(
          await this.analytics.getInactiveClients(commerceId, input.days_since as number)
        );
      case 'compare_periods':
        return JSON.stringify(
          await this.analytics.comparePeriods(
            commerceId,
            input.metric as string,
            input.period_a as string,
            input.period_b as string,
          )
        );
      default:
        return JSON.stringify({ error: 'Tool no reconocida' });
    }
  }
}
```

### 4.3 `AnalyticsService`

La única capa que toca la DB. Todas las funciones reciben `commerceId` como primer argumento y es **invariante** — no existe ningún endpoint público que lo exponga, solo lo llama `AgentService` internamente.

```typescript
// backend/src/analytics/analytics.service.ts — contratos

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // Resumen de un día específico (o hoy por defecto)
  async getDailySummary(commerceId: string, date?: string): Promise<DailySummaryResult>

  // Ventas de los últimos N días, agrupadas por día
  async getWeeklyTrend(commerceId: string, days: number): Promise<DailyPoint[]>

  // Franja horaria con más ventas (últimos 30 días o hoy)
  async getPeakHours(commerceId: string, period: 'today' | 'week' | 'month'): Promise<PeakHoursResult>

  // Top N clientes por monto total en un período
  async getTopClients(commerceId: string, period: string, limit?: number): Promise<ClientRank[]>

  // Top vendedores del mes
  async getTopVendors(commerceId: string, period: string): Promise<VendorRank[]>

  // Clientes que no han comprado en X días
  async getInactiveClients(commerceId: string, daysSince: number): Promise<InactiveClient[]>

  // Comparar una métrica entre dos períodos (revenue, cobros, ticket promedio)
  async comparePeriods(
    commerceId: string,
    metric: 'revenue' | 'transactions' | 'avg_ticket',
    periodA: string,
    periodB: string,
  ): Promise<ComparisonResult>
}
```

**Patrón de cache en Redis:**
```typescript
private async withCache<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const cached = await this.redis.get(key);
  if (cached) return JSON.parse(cached);
  const result = await fn();
  await this.redis.setex(key, ttlSeconds, JSON.stringify(result));
  return result;
}

// Uso:
async getDailySummary(commerceId: string, date?: string) {
  const d = date ?? new Date().toISOString().split('T')[0];
  const cacheKey = `analytics:${commerceId}:daily:${d}`;
  return this.withCache(cacheKey, 300, () => this.queryDailySummary(commerceId, d));
}
```

TTL recomendados:
| Query | TTL |
|---|---|
| Resumen del día actual | 5 min |
| Días históricos | 30 min |
| Top clientes / vendedores | 10 min |
| Hora pico | 10 min |
| Clientes inactivos | 15 min |

---

## 5. Catálogo de tools para Claude

Las tools se definen como JSON Schema en el array `tools` de la llamada a la API de Anthropic. El LLM decide cuáles usar y con qué parámetros según el mensaje del usuario.

```typescript
export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_daily_summary',
    description:
      'Obtiene el resumen de ventas de un día específico: total recaudado, número de cobros y comparación con el día anterior. Úsala cuando el usuario pregunte por las ventas de hoy o de una fecha concreta.',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Fecha en formato YYYY-MM-DD. Si no se especifica, usa el día de hoy.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_weekly_trend',
    description:
      'Devuelve los totales de ventas día a día para los últimos N días. Útil para identificar tendencias, mejores días de la semana o comparar semanas.',
    input_schema: {
      type: 'object',
      properties: {
        days: {
          type: 'integer',
          description: 'Número de días hacia atrás (7, 14 o 30).',
          enum: [7, 14, 30],
        },
      },
      required: ['days'],
    },
  },
  {
    name: 'get_peak_hours',
    description:
      'Obtiene las franjas horarias con más actividad de cobros. Devuelve el top de horas y la franja pico. Úsala cuando el usuario pregunte a qué hora vende más.',
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          description: 'Período a analizar.',
          enum: ['today', 'week', 'month'],
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_top_clients',
    description:
      'Lista los mejores clientes ordenados por monto total gastado en el período. Incluye número de visitas y total. Úsala para rankings de clientes o preguntas sobre fidelidad.',
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          description: 'Período: "this_month", "last_month", "last_30_days", "this_year".',
        },
        limit: {
          type: 'integer',
          description: 'Número máximo de clientes a devolver (máx 10).',
          default: 3,
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_top_vendors',
    description:
      'Lista el rendimiento de los vendedores: total vendido y número de transacciones. Solo relevante si el negocio tiene más de un vendedor.',
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          description: 'Período: "this_month", "last_month", "last_30_days".',
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_inactive_clients',
    description:
      'Devuelve clientes que no han regresado en X días. Útil para preguntas sobre clientes perdidos, retención o a quién hay que recuperar.',
    input_schema: {
      type: 'object',
      properties: {
        days_since: {
          type: 'integer',
          description: 'Días sin visita para considerar al cliente inactivo (ej: 14, 30).',
        },
      },
      required: ['days_since'],
    },
  },
  {
    name: 'compare_periods',
    description:
      'Compara una métrica entre dos períodos de tiempo. Úsala cuando el usuario quiera saber si vendió más este mes que el pasado, o esta semana vs la anterior.',
    input_schema: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          enum: ['revenue', 'transactions', 'avg_ticket'],
          description: 'Qué métrica comparar: ingresos totales, número de cobros o ticket promedio.',
        },
        period_a: {
          type: 'string',
          description: 'Período base (ej: "this_month", "this_week", "2026-03").',
        },
        period_b: {
          type: 'string',
          description: 'Período de comparación (ej: "last_month", "last_week", "2026-02").',
        },
      },
      required: ['metric', 'period_a', 'period_b'],
    },
  },
];
```

### Tabla de decisión tool → pregunta

| Pregunta del usuario | Tools que el agente debería invocar |
|---|---|
| "¿Cuánto vendí hoy?" | `get_daily_summary` |
| "¿Cómo voy esta semana?" | `get_weekly_trend(7)` + `get_daily_summary` |
| "¿Cuál es mi hora pico?" | `get_peak_hours(month)` |
| "¿Quién es mi mejor cliente?" | `get_top_clients(this_month)` |
| "¿Vendí más este mes que el pasado?" | `compare_periods(revenue, this_month, last_month)` |
| "¿Qué clientes no han vuelto?" | `get_inactive_clients(14)` |
| "¿Cómo va mi equipo este mes?" | `get_top_vendors(this_month)` |
| "Dame un resumen completo" | `get_daily_summary` + `get_weekly_trend(7)` + `get_peak_hours(month)` + `get_top_clients(this_month)` |

---

## 6. System prompt

El system prompt es el contrato de comportamiento del agente. Se construye dinámicamente con el contexto del comercio.

```typescript
function buildSystemPrompt(commerce: CommerceContext): string {
  return `
Eres el asistente financiero de "${commerce.name}", un negocio de ${commerce.category}.
Estás hablando con ${commerce.role === 'admin' ? 'el dueño o administrador' : 'un vendedor'} del negocio.
La fecha de hoy es ${new Date().toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

## Tu trabajo
Ayudar al dueño a entender cómo va su negocio usando los datos reales de sus ventas.
Cuando no tengas la información suficiente, usa las herramientas disponibles para consultarla.

## Reglas de tono
- Español neutro, sin regionalismos
- Tuteo directo: "vendiste", "tu mejor hora", "tus clientes"
- Números en dólares con símbolo: $94, no "94 USD"
- Comparaciones en lenguaje natural: "$12 más que ayer", no "+14.7%"
- Respuestas cortas y directas — el dueño está atendiendo su negocio
- Si el dato es positivo, celebra con moderación. Si es negativo, sé directo pero constructivo.
- Nunca uses términos como "KPI", "ROI", "métrica", "optimizar", "análisis estadístico"

## Cómo usar las herramientas
- Úsalas cuando el usuario pida datos concretos. Si ya tienes el dato en la conversación, no vuelvas a consultarlo.
- Puedes llamar varias herramientas en paralelo si la pregunta lo requiere.
- Si el resultado está vacío (sin ventas, sin clientes), responde con empatía: "Hoy todavía no hay cobros registrados."
- Nunca menciones al usuario que estás consultando datos internamente — solo da la respuesta.

## Límites
- Solo responde sobre el negocio "${commerce.name}". No hagas comparaciones con otras tiendas ni des consejos de gestión externos.
- Si te preguntan algo fuera de ventas/cobros del negocio, redirige amablemente.
  `.trim();
}
```

---

## 7. Flujo de datos detallado

### Turno simple (sin tool calls)

```
Usuario: "¿Cuánto vendí hoy?"

ChatController.handleMessage(sessionId, text)
  └─► ChatService.processMessage()
        ├─ Valida sessionId → carga CommerceContext (commerceId, role)
        ├─ Carga últimos 10 mensajes de ChatMessage (historial)
        ├─ Persiste mensaje del usuario en Prisma
        └─► AgentService.run(commerceId, role, "¿Cuánto vendí hoy?", history)
              ├─ buildSystemPrompt(commerce)
              ├─ buildMessages(history + nuevo mensaje)
              └─ callClaude(system, messages, tools)
                    │
                    ▼
              Claude responde: tool_use → get_daily_summary({ date: "2026-04-18" })
                    │
                    ▼
              AnalyticsService.getDailySummary("NEG001", "2026-04-18")
                    │  Redis miss → Prisma query → cache 5min
                    ▼
              { total: 127.50, cobros: 8, vs_yesterday: +23.00 }
                    │
                    ▼
              Re-llama Claude con tool_result
                    │
                    ▼
              Claude responde: "Hoy llevas $127,50 en 8 cobros. 
                                📈 $23 más que ayer a esta hora, buen ritmo."
                    │
                    ▼
        ChatService persiste respuesta en Prisma
        └─ Devuelve al frontend: { id, sender: 'bot', text, createdAt }
```

### Turno complejo (multi-tool)

```
Usuario: "¿Cómo fue esta semana? ¿Y mis mejores clientes?"

AgentService.run(...)
  └─► Claude → tool_use (dos en paralelo):
        ├─ get_weekly_trend({ days: 7 })
        └─► get_top_clients({ period: "this_week", limit: 3 })
  
  Promise.all([
    AnalyticsService.getWeeklyTrend("NEG001", 7),     → Redis o Prisma
    AnalyticsService.getTopClients("NEG001", "this_week", 3)  → Redis o Prisma
  ])

  Re-llama Claude con ambos tool_results
  └─► Claude responde texto con ambos datos integrados en lenguaje natural
```

---

## 8. Modelo de seguridad

### 8.1 Aislamiento de datos por comercio

```
                ┌─────────────────────────────────┐
                │        FLUJO DE commerceId       │
                │                                 │
  Session JWT   │  sessionId ──► ChatSession      │
  (futuro)      │                   └─ commerceId  │
                │                        │         │
                │                        ▼         │
                │              AnalyticsService    │
                │           (commerceId invariante)│
                │                        │         │
                │                        ▼         │
                │              WHERE business_id   │
                │               = commerceId       │
                └─────────────────────────────────┘
```

El `commerceId` viaja desde la sesión validada, **nunca desde el input del LLM**. En `dispatchTool`, el `commerceId` proviene del closure de la sesión, no del JSON que devuelve Claude.

### 8.2 Qué el LLM puede y no puede hacer

| Acción | Permitido |
|---|---|
| Consultar datos de su propio comercio | ✅ |
| Consultar datos de otro commerceId | ❌ (no posible — hardcoded en la sesión) |
| Ejecutar SQL arbitrario | ❌ (no existe esa tool) |
| Ver datos individuales de transacciones | ❌ (solo agregados) |
| Ver nombres completos de clientes | ✅ (necesario para el UX, son datos del propio comercio) |
| Filtrar por fecha arbitraria | ✅ (validada en AnalyticsService) |
| Devolver más de N resultados | ❌ (límite en AnalyticsService: `LIMIT Math.min(limit, 10)`) |

### 8.3 Validaciones en AnalyticsService

```typescript
// Siempre forzar el scope — nunca confiar en el input del LLM
async getTopClients(commerceId: string, period: string, limit = 3) {
  const safeLimit = Math.min(Math.max(limit, 1), 10); // nunca más de 10
  const { start, end } = parsePeriod(period);         // validar rango

  return this.prisma.transaction.groupBy({
    by: ['clientId', 'clientName'],
    where: {
      businessId: commerceId,   // ← invariante, siempre
      date: { gte: start, lte: end },
    },
    _sum: { amount: true },
    _count: { id: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: safeLimit,
  });
}
```

### 8.4 Rate limiting del agente

```typescript
// Prevenir abuso por sesión
const MAX_MESSAGES_PER_SESSION = 50;
const MAX_TOOL_CALLS_PER_MESSAGE = 5;

// En ChatService, antes de llamar AgentService:
const msgCount = await this.prisma.chatMessage.count({ where: { sessionId } });
if (msgCount > MAX_MESSAGES_PER_SESSION) {
  return { text: 'Has llegado al límite de mensajes de esta sesión. Inicia una nueva.' };
}
```

---

## 9. Refactorización de `ChatService`

El `ChatService` actual es simple y está bien. Solo hay que modificar `processMessage` para que delegue al agente:

```typescript
// backend/src/chat/chat.service.ts — nuevo
async processMessage(sessionId: string, text?: string, actionId?: string) {
  // 1. Validar sesión y obtener contexto del comercio
  const session = await this.prisma.chatSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  // 2. Guardar mensaje del usuario
  await this.prisma.chatMessage.create({
    data: { sessionId, sender: 'user', text: text ?? null, actionId: actionId ?? null },
  });

  // 3. Cargar historial reciente (ventana de contexto acotada)
  const history = await this.prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: 20,  // últimos 20 mensajes — suficiente contexto sin explotar tokens
  });

  // 4. Resolver el input (texto libre o quick reply)
  const userInput = text ?? this.resolveActionId(actionId);

  // 5. Llamar al agente
  const responseText = await this.agentService.run({
    commerceId: session.commerceId,
    role: session.role,
    userMessage: userInput,
    conversationHistory: history,
  });

  // 6. Persistir respuesta del bot
  const botMessage = await this.prisma.chatMessage.create({
    data: { sessionId, sender: 'bot', text: responseText },
  });

  return {
    id: botMessage.id,
    sender: 'bot',
    text: botMessage.text,
    createdAt: botMessage.createdAt,
  };
}

private resolveActionId(actionId?: string): string {
  // Quick replies predefinidos que el frontend puede enviar como botones
  const quickReplies: Record<string, string> = {
    'DAILY_SUMMARY':  '¿Cuánto vendí hoy?',
    'WEEKLY_TREND':   '¿Cómo fue esta semana?',
    'TOP_CLIENTS':    '¿Quiénes son mis mejores clientes?',
    'PEAK_HOURS':     '¿A qué hora vendo más?',
    'TEAM_RANKING':   '¿Cómo va mi equipo?',
    'INACTIVE':       '¿Qué clientes no han vuelto?',
  };
  return quickReplies[actionId ?? ''] ?? 'Hola';
}
```

---

## 10. Cambios en el frontend

### 10.1 Quick replies (botones de acción rápida)

Agregar botones de acceso directo justo encima del input para preguntas frecuentes. Estos envían `actionId` en lugar de texto libre:

```typescript
const QUICK_REPLIES = [
  { id: 'DAILY_SUMMARY',  label: 'Ventas de hoy' },
  { id: 'WEEKLY_TREND',   label: 'Esta semana' },
  { id: 'TOP_CLIENTS',    label: 'Mis clientes' },
  { id: 'PEAK_HOURS',     label: 'Hora pico' },
];
```

### 10.2 Estado de "pensando"

Mientras el agente procesa (puede tardar 2-5 seg en turno multi-tool), mostrar un indicador de tipeo:

```typescript
const [isThinking, setIsThinking] = useState(false);

// Skeleton de tres puntos animados mientras el agente trabaja
{isThinking && (
  <div className="flex items-end gap-2 self-start max-w-[85%]">
    <BotAvatar />
    <div className="bg-white border border-gray-100 rounded-[20px] rounded-bl-sm px-4 py-3">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
)}
```

---

## 11. Dependencias a instalar

### Backend (`/backend`)
```bash
npm install @anthropic-ai/sdk
```

No se necesita nada más — el SDK de Anthropic maneja los tipos de tool use.

### Variables de entorno nuevas
```env
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-haiku-4-5-20251001   # rápido para hackathon; cambiar a sonnet para producción
AGENT_MAX_TOOL_ITERATIONS=5
```

---

## 12. Roadmap de implementación

### Fase 1 — Core del agente (must-have)
1. Instalar `@anthropic-ai/sdk` en backend
2. Crear `AnalyticsModule` + `AnalyticsService` con las 7 tools conectadas a Prisma
3. Crear `AgentService` con el loop de tool use
4. Refactorizar `ChatService.processMessage` para delegar a `AgentService`
5. Conectar `ChatModule` a `AnalyticsModule`

### Fase 2 — Pulido de UX
6. Agregar quick replies en `ChatbotView`
7. Agregar estado "pensando" en el chat
8. Implementar cache Redis en `AnalyticsService`

### Fase 3 — Robustez (nice-to-have)
9. Rate limiting por sesión
10. Logging estructurado de tool calls (para debug y métricas)
11. JWT en `startSession` (reemplazar sessionId-como-token)

---

## 13. Decisiones de arquitectura y sus razones

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Tools como services internos (no HTTP) | AnalyticsController público | Sin superficie de ataque externa; el LLM no puede llamar endpoints directamente |
| `commerceId` desde la sesión, no del LLM | Pasar commerceId en el prompt | El LLM podría ser manipulado con prompt injection para cambiar el scope |
| Historial acotado a 20 mensajes | Historial completo | Coste de tokens acotado; 20 mensajes son más que suficientes para contexto conversacional |
| Claude Haiku para hackathon | GPT-4o, Gemini | Haiku es el modelo más rápido de Anthropic con tool use; el Anthropic SDK es más ergonómico |
| Redis cache por analytics query | Sin cache | El agente puede llamar la misma tool varias veces en un turno; el cache evita queries duplicadas |
| Tool calls en paralelo con `Promise.all` | Secuencial | Claude puede devolver múltiples tool_use en un solo response; ejecutarlas en paralelo reduce la latencia del turno |
| `MAX_TOOL_ITERATIONS = 5` | Sin límite | Previene loops infinitos si el modelo alucina una tool call circular |
