# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Cuentitas — Deuna Negocios** is a full-stack financial dashboard for microbusiness owners in Latin America. It shows daily sales summaries, peak hours, and client/vendor rankings in a simple, jargon-free UI targeted at low-tech users.

The repo is a monorepo with two separate npm projects:
- **Root (`/`)** — React 19 + TypeScript + Vite frontend
- **`/backend`** — NestJS 11 backend with PostgreSQL (Prisma) and Redis

---

## Commands

### Frontend (run from repo root)
```bash
npm install
npm run dev        # Vite dev server with HMR
npm run build      # TypeScript compile + Vite production build → dist/
npm run lint       # ESLint check
npm run preview    # Preview production build
```

### Backend (run from `/backend`)
```bash
npm install
npm run start:dev       # NestJS with watch mode (port 3000)
npm run build           # Compile TypeScript → dist/
npm run test            # Jest unit tests
npm run test:watch      # Jest in watch mode
npm run test:cov        # Coverage report
npm run test:e2e        # End-to-end tests (test/app.e2e-spec.ts)
npm run lint            # ESLint with auto-fix
```

### Running a single test
```bash
cd backend
npx jest --testPathPattern="chat.service"   # example: run only chat.service.spec.ts
```

### Database (Prisma, run from `/backend`)
```bash
npx prisma generate          # Regenerate Prisma client after schema changes
npx prisma migrate dev       # Apply migrations in development
npx prisma studio            # GUI browser for the database
```

---

## Environment Variables

Backend requires these env vars (no `.env` template is committed):

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string (Prisma / chat sessions) |
| `ANTHROPIC_API_KEY` | — | API key de Anthropic para el agente LangGraph |
| `CLAUDE_MODEL` | `claude-haiku-4-5-20251001` | Modelo de Claude a usar |
| `PORT` | `3000` | NestJS listen port |
| `REDIS_HOST` | `localhost` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |

---

## Architecture

### Frontend

- **Entry:** `src/main.tsx` → `src/App.tsx`
- `App.tsx` manages two top-level screens: `LoginScreen` (QR + role selection) and `DashboardScreen` (main app with bottom navigation).
- Feature-based component folders: `src/components/dashboard/`, `src/components/layout/`, `src/chatbot/`.
- Mock data lives in `src/data/mockData.ts` — the dashboard currently renders from mock data, not live API calls.
- API calls to the backend use Axios (no global HTTP client configured; calls are made directly in components).

### Backend

NestJS module hierarchy:
```
AppModule
  ├── PrismaModule (global DB service)
  ├── RedisModule (session caching via ioredis)
  └── ChatModule
        ├── ChatController  (POST /chat/session/start, POST /chat/message)
        └── ChatService     (session + message persistence; NLP is currently mocked)
```

- The chat NLP logic in `ChatService.processMessage` is a stub — it echoes back the input. This is the main area for real AI integration.
- Authentication is scaffolded (Passport + JWT deps present) but not enforced on any endpoints. `sessionId` currently acts as the access token.
- Redis is wired up but not actively used in the current chat flow (intended for session caching).

### Database Schema

Two Prisma models in `backend/prisma/schema.prisma`:
- `ChatSession` — one per user login; stores `commerceId` and `role` (`"admin"` | `"vendedor"`)
- `ChatMessage` — one per message; `sender` is `"user"` or `"bot"`; `actionId` stores quick-reply button IDs

### Test Data

`/data/` contains 12 months of synthetic transaction data (April 2025 – March 2026) for three test businesses:
- **Tienda de Carmita** — grocery store
- **Cafetería Don Roberto** — café
- **Bazar de Lucía** — bazaar

Available as SQLite (`data/cuentitas.db`) and CSV (`data/transactions.csv`). See `data/dataset_README.md` for schema details.

---

## Design Specification

`cuentitas-specs.md` is the authoritative UI/UX spec. Key rules:

**Color tokens:**
- Primary/accent: `#6B5CE7` (Deuna purple)
- Inactive bars/backgrounds: `#EEEDFE`
- Positive badge: bg `#EAF3DE`, text `#3B6D11`
- Negative badge: bg `#FCEBEB`, text `#A32D2D`
- Screen background: `#F5F4F0`
- Primary text: `#1A1A2E`, secondary: `#999999`

**Dashboard card order (vertical scroll, no tabs):**
1. Proactive alert (header pill)
2. Day summary — big number, 7-day bar chart, comparison badge
3. Peak hours — horizontal bar chart by 2-hour blocks (max 6 visible)
4. Client ranking — top 3, list format (no bars, no percentages)
5. Vendor ranking — *only shown if ≥ 2 vendors*

**Copy rules:** Spanish, tuteo, dollars as `$94` not `94 USD`, comparisons as `"$12 más que ayer"` not `"+14.7%"`. Never use financial jargon.

**Forbidden UI patterns:** pie charts, multi-series line charts, heatmaps, numbers above chart bars, percentages in rankings.
