# Propuesta: Motor de Insights Proactivos vía WhatsApp

**Proyecto:** Cuentitas — Deuna Negocios  
**Fecha:** Abril 2026  
**Autor:** Análisis de arquitectura senior  

---

## 1. Estado actual del sistema

### 1.1 WhatsApp

Funciona con `whatsapp-web.js` (automatización de browser vía Puppeteer). Actualmente **sí puede enviar mensajes**, pero con estas limitaciones:

| Aspecto | Estado actual |
|---|---|
| Envío de mensajes | ✅ Funcional |
| Autenticación | QR manual por consola (un solo escaneo, persiste en disco) |
| Proactividad | Solo un cron a las 6 PM, hardcoded para `commerceId = "1"` |
| Resiliencia | Sin reconexión automática, sin retry, sin circuit breaker |
| Multi-comercio | ❌ No implementado |

### 1.2 Agente conversacional

Usa LangGraph ReAct con `gpt-4o`. El agente es reactivo: solo actúa cuando el usuario escribe. Tiene 9 herramientas analíticas sobre SQLite. El scheduler actual llama a `generateInsightReport()` que usa el LLM para formatear el resumen diario — pero **el trigger es solo temporal (6 PM) y no analiza condiciones de negocio**.

### 1.3 El problema central

```
Situación actual:
  → Timer dispara a las 6 PM
  → Se llama siempre, sin importar qué pasó en el día
  → Mensaje genérico para un solo comercio
  → Costo LLM innecesario aunque no haya nada notable que reportar

Lo que queremos:
  → El sistema DETECTA algo relevante (récord, anomalía, hito)
  → Solo entonces formatea y envía
  → Mensaje personalizado, oportuno, corto
  → Funciona para múltiples comercios
```

---

## 2. Principios de diseño

### 2.1 Separación crítica: Detección vs. Formateo

El error más común (y costoso) en este tipo de sistemas es usar LLM para **detectar** si algo es notable. Eso es un antipatrón:

```
❌ Antipatrón:
   Polling cada 15 min → LLM analiza datos → decide si hay insight → formatea → envía
   Costo: N comercios × frecuencia × $0.01/llamada LLM = caro y lento

✅ Patrón correcto:
   Polling cada 15 min → SQL puro detecta triggers → si hay insight → LLM formatea → envía
   Costo LLM: solo cuando hay algo real que decir
```

La detección es lógica determinista. El LLM solo entra para escribir el mensaje en lenguaje natural.

### 2.2 Anti-spam: Throttling por regla

Un comercio no debe recibir más de 2-3 mensajes WhatsApp por día. Cada tipo de insight tiene un cooldown en Redis.

### 2.3 Costo real del sistema

Con el enfoque correcto:
- Checks de detección: **$0** (puro SQL)
- Formatos LLM por insight: ~**$0.001** con Haiku (128K tokens, muy pequeño)
- Un comercio activo genera ~2-4 insights/día
- **Costo estimado por comercio/mes: ~$0.10 - $0.30**

---

## 3. Arquitectura propuesta

### 3.1 Visión general

```mermaid
graph TB
    subgraph "Trigger Layer (sin LLM)"
        POLL[ProactiveSchedulerService<br/>⏱ Polling cada 15-30 min]
        DET[InsightDetectorService<br/>🔍 SQL puro - evalúa reglas]
        RULES[(InsightRules<br/>Configuración por comercio)]
    end

    subgraph "Throttle Layer (Redis)"
        THROT[InsightThrottleService<br/>🛑 Deduplicación y cooldown]
        REDIS[(Redis<br/>TTL por tipo de insight)]
    end

    subgraph "Generation Layer (LLM)"
        FMT[InsightFormatterService<br/>✍️ Solo formatea, no decide]
        LLM[Claude Haiku 4.5<br/>Mensaje corto y motivacional]
    end

    subgraph "Delivery Layer"
        ROUTER[DeliveryRouter<br/>📤 Selecciona canal]
        WA[WhatsappService<br/>📱 WhatsApp]
        PUSH[In-App Notification<br/>🔔 Deuna App]
    end

    subgraph "Data Layer"
        SQLITE[(SQLite<br/>cuentitas.db<br/>Analytics read-only)]
        ANALYTICS[AnalyticsService<br/>Queries existentes]
    end

    POLL -->|"Cada 15 min para cada comercio"| DET
    DET -->|"Lee reglas"| RULES
    DET -->|"SQL queries"| ANALYTICS
    ANALYTICS -->|"Lee"| SQLITE
    DET -->|"InsightEvent[]"| THROT
    THROT -->|"Verifica TTL"| REDIS
    THROT -->|"Insights no duplicados"| FMT
    FMT -->|"Prompt + datos"| LLM
    LLM -->|"Mensaje formateado"| ROUTER
    ROUTER -->|"WhatsApp si proactivo"| WA
    ROUTER -->|"In-app si sesión activa"| PUSH
```

### 3.2 Flujo detallado de un insight

```mermaid
sequenceDiagram
    participant CRON as Scheduler<br/>(cada 15 min)
    participant DET as InsightDetector
    participant DB as SQLite
    participant REDIS as Redis Throttle
    participant LLM as Claude Haiku
    participant WA as WhatsApp

    CRON->>DET: detectInsights(commerceId)
    
    loop Para cada regla activa
        DET->>DB: SELECT ... (detección SQL pura)
        DB-->>DET: metrics
        DET->>DET: evalúa condición (JS puro)
    end
    
    DET-->>CRON: InsightEvent[] (puede ser vacío)
    
    alt Hay insights detectados
        loop Por cada InsightEvent
            CRON->>REDIS: GET throttle:{commerceId}:{ruleId}
            
            alt No hay cooldown activo
                REDIS-->>CRON: null (libre)
                CRON->>LLM: formatMessage(InsightEvent)
                LLM-->>CRON: "El martes rompiste tu récord..."
                CRON->>WA: sendMessage(phone, message)
                CRON->>REDIS: SET throttle:{commerceId}:{ruleId} EX 86400
                Note over REDIS: Cooldown 24h activado
            else Cooldown activo
                REDIS-->>CRON: TTL restante
                CRON->>CRON: skip (ya notificado hoy)
            end
        end
    else Sin insights
        Note over CRON: No se llama al LLM.<br/>Costo: $0
    end
```

---

## 4. Catálogo de insights

Cada regla tiene: **condición SQL**, **cooldown**, **prioridad** y **ejemplo de mensaje**.

```mermaid
graph LR
    subgraph "🏆 Hitos positivos"
        R1[Récord del día<br/>ventas_hoy > max_historico]
        R2[Récord de hora<br/>ventas_hora > max_esa_hora]
        R3[Cliente estrella<br/>cliente gasta > su propio récord]
        R4[Racha semanal<br/>7 días seguidos con ventas]
    end

    subgraph "⚠️ Alertas de acción"
        R5[Arranque lento<br/>11am → ventas < 30% promedio]
        R6[Tarde muerta<br/>3pm-5pm sin ventas]
        R7[Cliente que vuelve<br/>inactivo +30 días hizo compra]
    end

    subgraph "📊 Contexto diario"
        R8[Cierre del día<br/>resumen a las 8pm]
        R9[Primer cliente<br/>primera venta del día]
        R10[Meta semanal<br/>alcanzó 80% de su promedio semanal]
    end
```

### 4.1 Definición detallada de reglas

```typescript
// Ejemplo de cómo se vería InsightRule[]

interface InsightRule {
  id: string;
  name: string;
  cooldownHours: number;    // Redis TTL
  priority: 'high' | 'medium' | 'low';
  detect: (commerceId: string, analytics: AnalyticsService) => Promise<InsightEvent | null>;
}

// Regla 1: Récord del día (antes del cierre)
{
  id: 'daily_record',
  cooldownHours: 24,
  detect: async (commerceId, analytics) => {
    const today = await analytics.getDailySummary(commerceId, today);
    const best = await analytics.getBestDay(commerceId);
    
    // Solo aplica si es antes de las 6pm (aún puede seguir subiendo)
    const hour = new Date().getHours();
    if (hour >= 18) return null;
    
    if (today.totalSales > best.totalSales) {
      return {
        ruleId: 'daily_record',
        data: { todaySales: today.totalSales, bestSales: best.totalSales, currentHour: hour },
        // El LLM formateará esto en lenguaje natural
      };
    }
    return null;
  }
}

// Regla 2: Arranque lento
{
  id: 'slow_start',
  cooldownHours: 24,
  detect: async (commerceId, analytics) => {
    const hour = new Date().getHours();
    if (hour !== 11) return null;  // Solo evalúa a las 11am
    
    const todayMorning = await analytics.getDailySummary(commerceId, today);
    const weekTrend = await analytics.getWeeklyTrend(commerceId, 7);
    const avgMorning = weekTrend.average; // promedio mañanas previas
    
    if (todayMorning.totalSales < avgMorning * 0.3) {
      return { ruleId: 'slow_start', data: { current: todayMorning.totalSales, avg: avgMorning } };
    }
    return null;
  }
}
```

---

## 5. Estructura de módulos NestJS

```mermaid
graph TB
    subgraph "Módulos nuevos a crear"
        IM[InsightsModule]
        IDS[InsightDetectorService]
        ITS[InsightThrottleService]
        IFS[InsightFormatterService]
        PSS[ProactiveSchedulerService<br/>reemplaza ReportSchedulerService]
        DR[DeliveryRouterService]
    end

    subgraph "Módulos existentes (sin cambios)"
        AM[AnalyticsModule]
        WM[WhatsappModule]
        RM[RedisModule]
        CM[ChatModule]
    end

    IM --> IDS
    IM --> ITS
    IM --> IFS
    IM --> PSS
    IM --> DR

    IDS --> AM
    ITS --> RM
    IFS -.->|"Claude Haiku API"| ANTHROPIC[Anthropic SDK]
    PSS --> IDS
    PSS --> ITS
    PSS --> IFS
    PSS --> DR
    DR --> WM
```

### 5.1 Archivos a crear

```
backend/src/insights/
├── insights.module.ts
├── insight-detector.service.ts      # SQL puro, sin LLM
├── insight-throttle.service.ts      # Redis deduplication
├── insight-formatter.service.ts     # LLM formatting (Claude Haiku)
├── delivery-router.service.ts       # Canal selection
├── proactive-scheduler.service.ts   # Orquestador principal
├── rules/
│   ├── daily-record.rule.ts
│   ├── slow-start.rule.ts
│   ├── returning-client.rule.ts
│   ├── day-summary.rule.ts
│   └── index.ts                     # Export InsightRules[]
└── types/
    ├── insight-event.ts
    └── insight-rule.ts
```

---

## 6. Configuración multi-comercio

El sistema actual tiene `commerceId` hardcoded a `"1"`. El diseño nuevo debe soportar múltiples comercios con distintas configuraciones.

```mermaid
erDiagram
    COMMERCE_CONFIG {
        string commerceId PK
        string whatsappPhone
        boolean proactiveEnabled
        string[] enabledRules
        int pollingIntervalMinutes
        string timezone
    }

    INSIGHT_LOG {
        string id PK
        string commerceId FK
        string ruleId
        string message
        string channel
        datetime sentAt
        boolean delivered
    }

    COMMERCE_CONFIG ||--o{ INSIGHT_LOG : "genera"
```

**Para el MVP:** Esta config puede vivir como variable de entorno o en un JSON simple. No requiere nueva tabla Prisma de inmediato.

```typescript
// Ejemplo config MVP (puede ser un JSON o env var)
const COMMERCE_CONFIGS = [
  {
    commerceId: '1',
    name: 'Tienda de Carmita',
    whatsappPhone: process.env.CARMITA_PHONE,
    proactiveEnabled: true,
    enabledRules: ['daily_record', 'slow_start', 'day_summary'],
    timezone: 'America/Guayaquil',
  }
];
```

---

## 7. Prompt de formateo (InsightFormatterService)

El LLM recibe datos crudos y genera el mensaje. El sistema decide si hay algo que decir; el LLM solo elige las palabras.

```
SYSTEM:
Eres el asistente financiero de Cuentitas. Escribe mensajes de WhatsApp
muy cortos (máximo 3 líneas) para dueños de negocios en Ecuador.
Reglas:
- Tuteo siempre ("¡Rompiste!", no "¡Usted rompió!")
- Dólares como "$94", nunca "94 USD"
- Emojis moderados (1-2 por mensaje, no más)
- Nada de jerga financiera (ni KPI, ni ROI, ni métricas)
- Positivo y motivacional, pero honesto
- Si es alerta, sugiere UNA acción concreta

USER:
Tipo de insight: daily_record
Datos: {
  "todaySales": 187.50,
  "bestHistoricSales": 183.00,
  "bestHistoricDate": "2025-11-15",
  "currentHour": 15,
  "topClient": "María López"
}

ASSISTANT:
🏆 ¡Récord del mes! Ya llevas $187 y aún son las 3 PM.
María López fue tu cliente estrella hoy.
¡A seguir así!
```

---

## 8. Plan de implementación

```mermaid
gantt
    title Roadmap de implementación
    dateFormat  YYYY-MM-DD
    section Fase 1 - Fundación
    InsightRule types + interfaces       :a1, 2026-04-20, 2d
    InsightDetectorService (3 reglas)    :a2, after a1, 3d
    InsightThrottleService (Redis)       :a3, after a1, 2d
    
    section Fase 2 - Formateo y envío
    InsightFormatterService (Haiku)      :b1, after a2, 2d
    DeliveryRouterService                :b2, after b1, 1d
    ProactiveSchedulerService            :b3, after b2, 2d
    
    section Fase 3 - Hardening
    Multi-commercio config               :c1, after b3, 2d
    Logging + InsightLog table           :c2, after c1, 2d
    WhatsApp reconnect + retry           :c3, after c2, 2d
    
    section Fase 4 - Expansión
    Reglas adicionales (7 → 10)          :d1, after c3, 3d
    Dashboard de insights enviados       :d2, after d1, 3d
```

### 8.1 Fase 1: Implementación mínima (1 semana)

**Meta:** Sistema detecta récord del día y envía mensajes reales.

1. Crear `InsightDetectorService` con 3 reglas: `daily_record`, `slow_start`, `day_summary`
2. Usar Redis existente (ya está en el proyecto) para throttle con TTL
3. Refactorizar `generateInsightReport()` en `InsightFormatterService` propio
4. Migrar `@Cron(6PM)` de `ReportSchedulerService` a `ProactiveSchedulerService` con polling configurable
5. Agregar `COMMERCE_CONFIGS` array como constante (sin DB por ahora)

**No requiere cambios en:** `WhatsappService`, `AnalyticsService`, `ChatModule`

---

## 9. Respuesta a la pregunta de costo

> "¿No sería muy costoso que el agente esté analizando todo el tiempo?"

**La clave es que el agente NO analiza.** El SQL analiza. El LLM solo escribe.

```
Escenario real para 10 comercios:
────────────────────────────────────────────────
Polling cada 20 min → 72 checks/día × 10 comercios = 720 SQL queries/día
Costo SQL: $0.00 (SQLite local)

Insights que disparan (estimado 2-4/día/comercio):
  → 3 comercios activos generan 9 insights/día
  → Claude Haiku: ~200 tokens por mensaje
  → $0.0008 por insight

Costo LLM total/día: ~$0.007
Costo LLM total/mes: ~$0.21
────────────────────────────────────────────────
```

**En producción con datos reales** (Postgres + event sourcing):
- Se elimina el polling
- Cada transacción dispara un evento
- El detector evalúa las reglas solo cuando hay movimiento real
- Costo LLM igual, pero latencia de insight pasa de ~20 min a segundos

---

## 10. Comparación: enfoque actual vs. propuesto

| Aspecto | Actual | Propuesto |
|---|---|---|
| Trigger | Timer fijo 6 PM | Event-driven via polling inteligente |
| Comercios | 1 (hardcoded) | N comercios configurables |
| Detección | LLM decide si hay algo notable | SQL determina, LLM solo formatea |
| Costo por día | Fijo (siempre llama LLM) | Variable (solo si hay insight real) |
| Tipos de insight | 1 (resumen diario) | 7+ (récords, alertas, hitos, contexto) |
| Cooldown | Ninguno (puede repetir mensajes) | Redis TTL por regla/comercio |
| Oportunidad | Solo cierre de día | Cualquier momento del día |
| WhatsApp reliability | Sin retry | Retry + circuit breaker |
| Logging | Console.log | InsightLog table en Prisma |

---

## 11. Decisión sobre WhatsApp Web vs. API oficial

`whatsapp-web.js` es bueno para MVP pero tiene riesgos:

| | whatsapp-web.js (actual) | WhatsApp Business API (Meta) |
|---|---|---|
| Costo | Gratis | $0.05-$0.15 por conversación |
| Setup | QR manual, Puppeteer | Webhook HTTPS, número registrado |
| Fiabilidad | Puede ser baneado por Meta | Oficial, sin riesgo de baneo |
| Escala | 1 número, limitado | Multi-número, alta escala |
| Para el reto | ✅ Suficiente | Overkill para demo |

**Recomendación:** Mantener `whatsapp-web.js` para el hackathon. En producción real, migrar a la API oficial de Meta vía Twilio o 360Dialog.

---

## 12. Próximos pasos inmediatos

1. **Crear `InsightRule` interface** en `backend/src/insights/types/insight-rule.ts`
2. **Implementar 3 reglas SQL** sin tocar nada del sistema actual
3. **Refactorizar `InsightThrottleService`** usando el `RedisService` ya existente
4. **Reemplazar el cron de 6 PM** por polling configurable con evaluación de reglas
5. **Cambiar `AgentService.generateInsightReport`** a `InsightFormatterService` más estructurado
6. **Agregar Claude Haiku** para formateo (ya existe `ANTHROPIC_API_KEY` en `.env`)

> El sistema actual ya tiene el 70% de los bloques necesarios. Esta propuesta es una reorganización de responsabilidades más que una reescritura.
