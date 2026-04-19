# Setup local — Guía completa

## Prerrequisitos

| Herramienta | Versión mínima | Verificar |
|---|---|---|
| Node.js | 20 | `node --version` |
| npm | 9 | `npm --version` |
| Docker | Cualquiera | `docker --version` (para Redis) |
| Chrome/Chromium | Cualquiera | Para WhatsApp |

---

## 1. Clonar e instalar dependencias

```bash
git clone https://github.com/Donly666/Deuna.git
cd Deuna

# Frontend
npm install

# Backend
cd backend && npm install && cd ..
```

---

## 2. Crear el archivo de entorno del backend

```bash
cp backend/.env.example backend/.env
```

Editar `backend/.env` con tus valores reales:

```env
DATABASE_URL="file:./dev.db"

# LLM (OpenAI — requerido para el agente y el formatter de insights)
OPENAI_API_KEY=sk-proj-...

# LLM (Anthropic — disponible en el proyecto, ver agent.service.ts)
ANTHROPIC_API_KEY=sk-ant-...

# Redis (opcional — sin Redis el sistema funciona, solo sin throttle persistente)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_SESSION_TTL=3600

# Auth
JWT_SECRET=cualquier-string-largo-y-random

# WhatsApp — número al que llegan los insights proactivos
# Formato: código de país + número, sin + ni espacios
# Ecuador: 593 + número sin el 0 inicial → 593987654321
DEMO_DESTINATION_PHONE=593900000000
DEMO_DESTINATION_PHONE_2=593900000001

PORT=3000
```

> **Solo `OPENAI_API_KEY` es imprescindible** para que el agente IA y los insights funcionen.

---

## 3. Inicializar la base de datos de sesiones

Solo la primera vez (crea `backend/dev.db`):

```bash
cd backend
npx prisma db push
cd ..
```

La base de datos de analytics (`data/cuentitas.db`) ya viene en el repositorio — no requiere setup.

---

## 4. Levantar Redis (opcional pero recomendado)

Sin Redis, el sistema funciona pero los insights no tienen throttle persistente (podrían repetirse al reiniciar el servidor).

```bash
docker run -d -p 6379:6379 --name redis-cuentitas redis:7-alpine
```

Para detenerlo: `docker stop redis-cuentitas`

---

## 5. Levantar el stack (dos terminales)

**Terminal 1 — Backend:**

```bash
cd backend
npm run start:dev
```

Espera ver en consola:
```
[InstanceLoader] InsightsModule dependencies initialized
[RouterExplorer] Mapped {/insights/trigger, POST}
[WhatsappService] Initializing WhatsApp Client...
[WhatsappService] Scan the QR code to authenticate WhatsApp:  ← escanear aquí
...
[WhatsappService] WhatsApp Client is ready!
[NestApplication] Nest application successfully started on port 3000
```

**Terminal 2 — Frontend:**

```bash
# Desde la raíz del repositorio
npm run dev
```

Abre `http://localhost:5173`.

---

## 6. Autenticar WhatsApp

Al iniciar el backend por primera vez, verás un QR en la consola. Escanearlo con WhatsApp:

1. Abrir WhatsApp en el teléfono
2. Menú (3 puntos) → **Dispositivos vinculados** → **Vincular un dispositivo**
3. Escanear el QR que aparece en la terminal

La sesión se guarda en `backend/data/whatsapp-auth/`. Los reinicios posteriores no requieren re-escanear.

---

## 7. Verificar que todo funciona

```bash
# Backend health
curl http://localhost:3000

# Iniciar sesión de chat
curl -s -X POST http://localhost:3000/chat/session/start \
  -H "Content-Type: application/json" \
  -d '{"commerceId": "NEG001", "role": "admin"}'

# Trigger manual de insights (fecha histórica con datos)
curl -X POST http://localhost:3000/insights/trigger \
  -H "Content-Type: application/json" \
  -d '{"commerceId": "NEG001", "datetime": "2026-03-10T20:00:00"}'
```

---

## Solución de problemas

### Error de Puppeteer al iniciar

```
Error: Navigating frame was detached
```

Causa: el flag `--single-process` no es compatible con Chromium en Windows. Ya está corregido en `whatsapp.service.ts`.

Si el error persiste, Puppeteer no encuentra el binario de Chrome. Agregar al `backend/.env`:

```env
PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

Y en `WhatsappService` constructor agregar `executablePath: process.env.PUPPETEER_EXECUTABLE_PATH` a los puppeteer args.

### `eventsDetected: 0` al hacer trigger

El dataset cubre abril 2025 – marzo 2026. Si no pasas `date` o `datetime`, el sistema usa hoy (2026-04-XX) que no tiene datos. Siempre pasar una fecha del rango del dataset:

```bash
# ✅ Correcto — fecha con datos
-d '{"commerceId": "NEG001", "datetime": "2026-03-10T20:00:00"}'

# ❌ Incorrecto — hoy no tiene datos en el dataset
-d '{"commerceId": "NEG001"}'
```

### Error de Redis en consola

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

No es bloqueante. El sistema funciona sin Redis. Para silenciarlo, levantar Redis con Docker (paso 4).

### La tabla `ChatSession` no existe

```bash
cd backend && npx prisma db push
```

### `address already in use :::3000`

Otro proceso usa el puerto. Cambiarlo en `backend/.env`:

```env
PORT=3001
```

---

## Comandos de referencia

```bash
# Frontend
npm run dev          # Dev server (HMR)
npm run build        # Build de producción → dist/
npm run lint         # ESLint

# Backend
cd backend
npm run start:dev    # Dev con watch
npm run build        # Compilar a dist/
npm run test         # Jest unit tests
npm run lint         # ESLint + autofix

# Prisma
npx prisma db push   # Crear/sincronizar tablas
npx prisma studio    # GUI de la base de datos
npx prisma generate  # Regenerar cliente tras cambiar schema.prisma

# Swagger
# http://localhost:3000/api — con el backend corriendo
```
