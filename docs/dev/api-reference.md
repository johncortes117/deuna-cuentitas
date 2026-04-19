# Referencia de la API

Base URL: `http://localhost:3000`  
Documentación interactiva: `http://localhost:3000/api` (Swagger UI)

---

## Chat

### `POST /chat/session/start`

Crea una sesión de chat y devuelve el mensaje de bienvenida con quick replies.

**Request:**
```json
{
  "commerceId": "NEG001",
  "role": "admin"
}
```

`role` acepta: `"admin"` | `"vendedor"`

**Response `201`:**
```json
{
  "sessionId": "uuid-generado",
  "message": "¡Hola! Soy tu asistente de Cuentitas...",
  "quickReplies": [
    { "id": "DAILY_SUMMARY", "label": "¿Cómo van hoy?" },
    { "id": "WEEKLY_TREND",  "label": "¿Cómo fue la semana?" },
    { "id": "TOP_CLIENTS",   "label": "Mejores clientes" }
  ]
}
```

---

### `POST /chat/message`

Envía un mensaje al agente. Acepta texto libre o un ID de quick reply (nunca los dos juntos).

**Request con texto:**
```json
{
  "sessionId": "uuid-de-la-sesion",
  "text": "¿Quiénes son mis mejores clientes este mes?"
}
```

**Request con quick reply:**
```json
{
  "sessionId": "uuid-de-la-sesion",
  "actionId": "TOP_CLIENTS"
}
```

**IDs de quick reply disponibles:**

| ID | Pregunta que resuelve |
|---|---|
| `DAILY_SUMMARY` | ¿Cómo van las ventas de hoy? |
| `WEEKLY_TREND` | ¿Cómo fue esta semana? |
| `TOP_CLIENTS` | ¿Quiénes son mis mejores clientes? |
| `PEAK_HOURS` | ¿A qué hora vendo más? |
| `TEAM_RANKING` | ¿Cómo va mi equipo? |
| `INACTIVE` | ¿Qué clientes no han vuelto? |
| `COMPARE_WEEKS` | ¿Esta semana vs la anterior? |
| `BEST_DAY` | ¿Cuál fue mi mejor día? |
| `GENERAL` | Dame un resumen general |

**Response `201`:**
```json
{
  "id": "uuid-mensaje",
  "sender": "bot",
  "text": "Este mes tus mejores clientes fueron...",
  "createdAt": "2026-03-10T15:30:00.000Z",
  "quickReplies": [
    { "id": "WEEKLY_TREND", "label": "¿Cómo fue la semana?" },
    { "id": "INACTIVE",     "label": "Clientes inactivos" },
    { "id": "COMPARE_WEEKS","label": "Comparar semanas" }
  ]
}
```

---

## Insights proactivos

### `POST /insights/trigger`

Dispara manualmente el ciclo de detección de insights para un comercio.

Cuando se pasa `date` o `datetime`, el throttle se **omite automáticamente** — útil para testing.

**Request:**
```json
{
  "commerceId": "NEG001",
  "datetime": "2026-03-10T20:00:00"
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `commerceId` | string | Opcional. Default: `"NEG001"` |
| `date` | string `YYYY-MM-DD` | Simula el ciclo a las 12pm de esa fecha |
| `datetime` | string ISO 8601 | Control total del reloj (ej: `"2026-03-10T20:00:00"` para probar day_closing) |

**Response `201`:**
```json
{
  "commerceId": "NEG001",
  "eventsDetected": 2,
  "messagesSent": 1,
  "throttled": 1
}
```

**Cuándo usar `date` vs `datetime`:**

```bash
# Prueba daily_record (hora 12 → antes del cierre) y returning_client
curl -X POST http://localhost:3000/insights/trigger \
  -H "Content-Type: application/json" \
  -d '{"commerceId": "NEG001", "date": "2026-03-10"}'

# Prueba day_closing (hora 20 → ventana 19-21pm)
curl -X POST http://localhost:3000/insights/trigger \
  -H "Content-Type: application/json" \
  -d '{"commerceId": "NEG001", "datetime": "2026-03-10T20:00:00"}'

# Prueba slow_start (hora 11 → ventana 10-12am)
curl -X POST http://localhost:3000/insights/trigger \
  -H "Content-Type: application/json" \
  -d '{"commerceId": "NEG001", "datetime": "2026-03-10T11:00:00"}'
```

---

### `POST /insights/throttle/clear`

Elimina el cooldown de un insight para que pueda dispararse de nuevo inmediatamente.

**Request:**
```json
{
  "commerceId": "NEG001",
  "ruleId": "daily_record"
}
```

IDs de reglas disponibles: `daily_record` | `slow_start` | `returning_client` | `day_closing`

**Response `201`:** (vacío — operación idempotente)

---

## Misc

### `GET /`

Health check.

**Response `200`:**
```json
"Hello World!"
```

---

## Errores comunes

| Código | Causa | Solución |
|---|---|---|
| `500` | Body sin `Content-Type: application/json` | Agregar el header |
| `404` | `commerceId` no existe en `commerce.configs.ts` | Usar `NEG001` o `NEG002` |
| `400` | `sessionId` inválido en `/chat/message` | Crear sesión primero con `/chat/session/start` |
