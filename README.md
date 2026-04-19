# Cuentitas — Deuna Negocios

Dashboard financiero conversacional para dueños de micronegocios. Muestra ventas del día, horas pico y rankings de clientes, con un agente IA que responde preguntas en lenguaje natural sobre los datos del negocio.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| Backend | NestJS 11 (Node.js) |
| Agente IA | LangGraph ReAct + Claude Haiku (Anthropic) |
| DB sesiones | SQLite via Prisma (`backend/dev.db`) |
| DB analytics | SQLite read-only via better-sqlite3 (`data/cuentitas.db`) |

---

## Requisitos previos

- **Node.js ≥ 20** y **npm**
- **Clave de API de Anthropic** — la necesita el agente IA

Redis es opcional: el backend arranca sin él (usa `lazyConnect`).

---

## Instalación

```bash
# 1. Clonar y entrar al repositorio
git clone https://github.com/Donly666/Deuna.git
cd Deuna

# 2. Instalar dependencias del frontend
npm install

# 3. Instalar dependencias del backend
cd backend
npm install
```

---

## Variables de entorno

El backend necesita un archivo `backend/.env`. Ya debería existir; si no, créalo:

```env
# Base de datos de sesiones (SQLite — no requiere servidor externo)
DATABASE_URL="file:./dev.db"

# Agente IA — REQUERIDO
ANTHROPIC_API_KEY="sk-ant-..."

# Modelo de Claude (opcional, este es el default)
CLAUDE_MODEL="claude-haiku-4-5-20251001"

# Puerto del servidor (opcional, default 3000)
PORT=3000

# Redis (opcional — el backend arranca sin Redis)
REDIS_HOST="localhost"
REDIS_PORT=6379
```

> **Solo `ANTHROPIC_API_KEY` es imprescindible** para que el agente responda con inteligencia real. Sin ella, la app arranca pero el chat falla.

---

## Preparar la base de datos de sesiones

Solo la primera vez (crea `backend/dev.db` con las tablas de chat):

```bash
cd backend
npx prisma db push
```

La base de datos de analytics (`data/cuentitas.db`) ya viene incluida en el repositorio con 12 meses de datos sintéticos — no requiere ninguna configuración.

---

## Levantar el stack

Necesitas **dos terminales** abiertas simultáneamente.

### Terminal 1 — Backend (API + Agente IA)

```bash
cd backend
npm run start:dev
```

Arranca en `http://localhost:3000`. Verás en consola:

```
[NestFactory] Starting Nest application...
[RouterExplorer] Mapped {/chat/session/start, POST}
[RouterExplorer] Mapped {/chat/message, POST}
[NestApplication] Nest application successfully started
```

### Terminal 2 — Frontend

```bash
# Desde la raíz del repositorio
npm run dev
```

Arranca en `http://localhost:5173`. El frontend se conecta automáticamente al backend en `localhost:3000`.

---

## Verificar que funciona

### Health check del backend

```bash
curl http://localhost:3000
```

### Probar el agente manualmente

```bash
# 1. Abrir sesión (devuelve sessionId y quick replies)
curl -s -X POST http://localhost:3000/chat/session/start \
  -H "Content-Type: application/json" \
  -d '{"commerceId": "NEG001", "role": "admin"}' | jq

# 2. Enviar mensaje al agente (reemplaza SESSION_ID)
curl -s -X POST http://localhost:3000/chat/message \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "SESSION_ID", "text": "¿Quiénes son mis mejores clientes este mes?"}' | jq
```

El agente responderá con datos reales de la base de datos de analytics.

---

## Datos de prueba

`data/cuentitas.db` contiene 12 meses de transacciones sintéticas (abril 2025 – marzo 2026) para tres negocios de demostración:

| ID | Negocio | Características |
|---|---|---|
| `NEG001` | Tienda de Carmita | Clientes fieles, pico al mediodía, 2 vendedores |
| `NEG002` | Cafetería Don Roberto | Crecimiento sostenido, pico mañana (7–9am), sin equipo |
| `NEG003` | Bazar de Lucía | Caída progresiva, dependencia de fines de semana |

Para cambiar de negocio en el frontend, modifica `COMMERCE_ID` en `src/chatbot/ChatbotView.tsx`.

---

## Preguntas que entiende el agente

El agente IA usa LangGraph ReAct y puede encadenar múltiples herramientas para responder:

| Pregunta | Herramientas que usa |
|---|---|
| ¿Cuánto vendí hoy? | `get_daily_summary` |
| ¿Cómo fue esta semana? | `get_weekly_trend` |
| ¿A qué hora vendo más? | `get_peak_hours` |
| ¿Quiénes son mis mejores clientes? | `get_top_clients` |
| ¿Cómo va mi equipo? | `get_top_vendors` |
| ¿Qué clientes no han vuelto? | `get_inactive_clients` |
| ¿Esta semana vs la anterior? | `compare_weeks` |
| ¿Cuál fue mi mejor día? | `get_best_day` |
| Dame un resumen general | `get_general_summary` |
| Pregunta multi-parte | Combina varias herramientas en paralelo |

---

## Comandos útiles

### Frontend

```bash
npm run dev          # Servidor de desarrollo con HMR
npm run build        # Build de producción → dist/
npm run lint         # ESLint
```

### Backend

```bash
cd backend
npm run start:dev    # Desarrollo con recarga automática
npm run build        # Compilar TypeScript → dist/
npm run test         # Tests unitarios (Jest)
npm run lint         # ESLint con auto-fix
```

### Prisma (base de datos de sesiones)

```bash
cd backend
npx prisma db push        # Crear/sincronizar tablas (primera vez)
npx prisma studio         # GUI para explorar la base de datos
npx prisma generate       # Regenerar cliente tras cambiar schema.prisma
```

### Documentación de la API (Swagger)

Con el backend corriendo, abre: `http://localhost:3000/api`

---

## Estructura del proyecto

```
Deuna/
├── src/                          # Frontend React
│   ├── App.tsx                   # Pantallas: Login y Dashboard
│   ├── chatbot/ChatbotView.tsx   # Interfaz del agente IA
│   ├── components/dashboard/     # Tarjetas de Mis Cuentitas
│   └── data/mockData.ts          # Datos mock del dashboard
│
├── backend/
│   ├── src/
│   │   ├── analytics/            # Queries tipados sobre SQLite (read-only)
│   │   ├── chat/
│   │   │   ├── agent.service.ts  # Agente LangGraph ReAct + 9 tools
│   │   │   ├── agent.prompts.ts  # System prompt del agente
│   │   │   ├── chat.service.ts   # Orquestación de sesión y mensajes
│   │   │   └── chat.controller.ts
│   │   ├── db/                   # DbService: acceso a cuentitas.db
│   │   └── prisma/               # PrismaService: dev.db (sesiones)
│   ├── prisma/schema.prisma      # Modelos ChatSession y ChatMessage
│   └── .env                      # Variables de entorno (ANTHROPIC_API_KEY aquí)
│
├── data/
│   ├── cuentitas.db              # Analytics SQLite (no modificar)
│   └── transactions.csv          # Mismo dataset en CSV
│
├── CLAUDE.md                     # Guía para Claude Code
└── AGENT_ARCHITECTURE.md         # Documento de arquitectura del agente
```

---

## Solución de problemas

**El agente responde "tuve un problema procesando tu consulta"**
→ Verifica que `ANTHROPIC_API_KEY` esté en `backend/.env` y sea válida.

**Error `address already in use :::3000`**
→ Ya hay un proceso corriendo. Detén el proceso anterior o cambia el puerto con `PORT=3001` en `.env`.

**Error al abrir `cuentitas.db`**
→ Verifica que el backend se ejecuta desde `backend/` (no desde otro directorio). El path a la DB de analytics se resuelve como `../data/cuentitas.db` relativo a `process.cwd()`.

**La tabla `ChatSession` no existe**
→ Ejecuta `npx prisma db push` desde `backend/`.

**Redis connection errors en consola**
→ Son advertencias no bloqueantes. El backend funciona sin Redis; ignóralos para desarrollo local.
