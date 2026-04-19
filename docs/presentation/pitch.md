# Cuentitas — Pitch del Hackathon

## El problema

El 70% de los microempresarios en Latinoamérica no tienen acceso a herramientas financieras que entiendan su negocio. Usan Deuna para cobrar, pero no saben qué está pasando con sus ventas. No entienden tendencias, no saben cuándo fue su mejor hora, no recuerdan qué clientes no han vuelto.

Las soluciones existentes son para negocios grandes, con jerga financiera, dashboards complejos y curvas de aprendizaje que los excluyen.

---

## La solución: Cuentitas

**Cuentitas** es el asistente financiero inteligente de Deuna Negocios. Le habla al dueño del negocio como un socio de confianza, en español, con datos reales de sus ventas.

Dos canales de acceso:

### 1. Chat conversacional en la app
El usuario pregunta en lenguaje natural y el agente responde con los datos de su negocio:

> *"¿Cómo me fue esta semana comparado con la anterior?"*
> → El agente consulta las ventas, hace el cálculo y responde:
> *"Esta semana vendiste $234, que es $41 más que la semana pasada. Tu mejor día fue el miércoles con $89."*

### 2. Insights proactivos por WhatsApp
Sin que el usuario tenga que preguntar nada, Cuentitas analiza los datos cada 30 minutos y envía mensajes cuando detecta algo relevante:

> 🏆 *"¡Récord del mes! Ya llevas $187 y aún son las 3 PM. María López fue tu cliente estrella hoy. ¡A seguir así!"*

> ☕ *"La mañana arrancó tranquila — apenas $12 a las 11am. Considera activar una promoción hoy."*

---

## Por qué importa

| Métrica | Impacto |
|---|---|
| **Tiempo de respuesta** | Respuesta en < 3 segundos, sin abrir la app |
| **Cero jerga** | Sin KPI, ROI ni "métricas". Solo lenguaje cotidiano |
| **Proactivo** | El negocio no necesita acordarse de revisar. Cuentitas avisa |
| **Costo** | ~$0.21/mes por negocio en llamadas LLM (detección SQL pura) |

---

## Stack tecnológico

```
Frontend          → React 19 + TypeScript + Vite + Tailwind CSS
Backend           → NestJS 11 (Node.js)
Agente IA         → LangGraph ReAct + OpenAI gpt-4o (9 herramientas analíticas)
Insights format   → gpt-4o-mini (mensajes cortos, ~$0.001 por insight)
Base de datos     → SQLite (analytics read-only) + SQLite via Prisma (sesiones)
Cache / Throttle  → Redis (cooldown de insights por comercio)
WhatsApp          → whatsapp-web.js (Puppeteer-based, demo MVP)
```

---

## Los tres negocios de demo

| ID | Negocio | Perfil |
|---|---|---|
| `NEG001` | Tienda de Carmita | Estable, clientes fieles, 2 vendedores, pico al mediodía |
| `NEG002` | Cafetería Don Roberto | Crecimiento sostenido, pico mañana 7–9am, operación individual |
| `NEG003` | Bazar de Lucía | Tendencia bajista, dependencia de fines de semana |

12 meses de transacciones sintéticas (abril 2025 – marzo 2026) con patrones realistas para cada perfil.

---

## Diferenciadores clave

1. **Detección sin LLM** — Las reglas de insights son SQL puro. El LLM solo formatea el mensaje cuando hay algo real que decir. Esto hace el sistema económicamente escalable.

2. **Arquitectura de reglas extensible** — Agregar un nuevo tipo de insight es implementar una función que devuelve `InsightEvent | null`. Sin tocar el orquestador.

3. **Reloj inyectable en reglas** — Cada regla recibe un `RuleContext.now: Date` que puede ser sobreescrito en testing. Esto permite probar con datos históricos sin mocks.

4. **Anti-spam por diseño** — Redis TTL por `(commerceId, ruleId)` garantiza que el mismo insight no se repita más de una vez por cooldown configurado. Sin esto, un negocio con muchas ventas recibiría spam.
