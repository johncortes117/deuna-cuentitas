# Guía de Demo en Vivo — 5 minutos

Script para presentar Cuentitas en el hackathon. El stack debe estar corriendo antes de empezar.

---

## Preparación previa (10 min antes)

```bash
# Terminal 1: backend
cd backend && npm run start:dev

# Terminal 2: frontend
npm run dev

# Verificar que WhatsApp esté autenticado (ver "WhatsApp Client is ready!" en logs)
```

Tener abierto en el browser: `http://localhost:5173`

---

## Flujo de demo (5 minutos)

### Minuto 1 — El problema

> *"El 70% de los dueños de negocios en Latinoamérica que usan Deuna para cobrar, no saben qué está pasando con sus ventas. Cuentitas cambia eso."*

Mostrar la pantalla de login en el browser. Elegir **Carmita** como comercio, rol **Admin**, hacer clic en "Ingresar".

### Minuto 2 — El dashboard

Mostrar el dashboard: ventas del día, horas pico, ranking de clientes. Señalar:

> *"Todo esto es data real. Sin configuración, sin planillas. El dueño del negocio ve esto apenas abre la app."*

### Minuto 3 — El agente conversacional

Navegar a la pestaña **Cuentitas** (ícono IA en el bottom nav). Escribir:

> **"¿Cómo me fue esta semana comparado con la anterior?"**

Esperar la respuesta del agente (< 3 segundos). Luego escribir:

> **"¿Qué clientes no han vuelto en el último mes?"**

Señalar que el agente encadena múltiples herramientas automáticamente y responde en lenguaje natural, sin jerga.

### Minuto 4 — Insights proactivos por WhatsApp

Abrir Swagger UI: `http://localhost:3000/api` (o usar curl en otra terminal). Ejecutar:

```bash
curl -X POST http://localhost:3000/insights/trigger \
  -H "Content-Type: application/json" \
  -d '{"commerceId": "NEG001", "datetime": "2026-03-10T20:00:00"}'
```

Mostrar la respuesta JSON y el mensaje que llega por WhatsApp al teléfono:

> *"Sin que Carmita haga nada, a las 8 PM recibe esto en su WhatsApp: el resumen del día, cuánto vendió, quiénes fueron sus mejores clientes."*

### Minuto 5 — Diferenciadores y escalabilidad

> *"Lo interesante no es solo el mensaje. Es que el sistema detecta el evento con SQL puro — sin llamar al LLM. Solo llama al LLM cuando hay algo que decir. Eso lo hace escalable a miles de negocios por menos de $0.21 por negocio al mes."*

Mostrar el `TriggerResult` en la respuesta:
```json
{
  "eventsDetected": 1,
  "messagesSent": 1,
  "throttled": 0
}
```

---

## Preguntas frecuentes de jueces

**¿Por qué WhatsApp y no push notification?**
> WhatsApp tiene 98% de apertura vs 30% de push. Para microempresarios que ya viven en WhatsApp, es el canal más natural.

**¿Qué pasa si el negocio ya recibió el insight hoy?**
> Redis guarda un TTL por `(commerceId, ruleId)`. Si el insight ya se envió dentro del cooldown (24h para récords), simplemente no vuelve a enviarse.

**¿Cómo agregan una nueva regla de insight?**
> Crear un archivo en `backend/src/insights/rules/`, implementar la función `detect()` que devuelve `InsightEvent | null`, y agregar al array `INSIGHT_RULES`. El orquestador la recoge automáticamente.

**¿Cómo escala a producción?**
> WhatsApp Business API (Meta) reemplaza a `whatsapp-web.js`. Postgres reemplaza SQLite. El resto del sistema (reglas, throttle, formatter) escala horizontalmente sin cambios.
