# MitiMiti

**Divide la cuenta en la mesa, sin calculadora. Cuentas claras, amistades largas.**

MitiMiti es una app web (PWA) para dividir cuentas entre amigos y anotar préstamos
pequeños. Quien pagó crea la cuenta, los demás entran con un link de WhatsApp, un QR
o un código de 6 letras, sin descargar nada y sin contraseña. Cada uno ve cuánto le
toca y los datos de quien pagó para transferirle, y avisa "Ya le pagué" con un toque.

Es la versión independiente de MitiMiti: no depende de Deuna ni de ningún banco.
MitiMiti **no mueve dinero**: dice cuánto y a quién; cada uno paga como prefiera
(transferencia, Deuna, Payphone, efectivo).

> La versión integrada en Deuna Negocios sigue en la raíz de este repositorio. Esta
> carpeta es un proyecto aparte (su propio `package.json`, base de datos y despliegue).

| | |
|---|---|
| Producto y estrategia | [`docs/PRODUCTO.md`](docs/PRODUCTO.md) |
| Diseño y escritura | [`docs/DISENO.md`](docs/DISENO.md) |
| Base de datos (Supabase) | [`supabase/schema.sql`](supabase/schema.sql) |
| Métricas del negocio | [`supabase/metrics.sql`](supabase/metrics.sql) |

---

## Qué hace

- **Dividir una cuenta** en 3 formas: partes iguales (los centavos que sobran los pone
  quien pagó), montos diferentes (al cambiar uno, el resto se reparte solo) o por
  productos (cada uno marca lo suyo; lo compartido se divide; IVA, servicio y propina
  se reparten en proporción a lo que consumió cada uno).
- **Entrar sin instalar nada**: link, QR (cámara del celular) o código dictado en la
  mesa. Solo se pide el nombre.
- **Alguien sin celular** (la abuela): se agrega a mano; su parte sale con un link que
  su familia puede abrir para quedarse con la deuda.
- **Pagar fuera de la app** con los datos de quien cobra, listos para copiar (número de
  Deuna o Payphone, banco + tipo + número de cuenta + titular + cédula).
- **"Ya le pagué" → "Recibido"**: quien debe avisa y quien cobra confirma (o "No me
  llegó"). Quien cobra también puede anotar "Ya me pagó" (efectivo) o perdonar.
- **Préstamos con link** ("te presté $5 para el taxi"): se anotan en un toque y se
  mandan por WhatsApp; el amigo confirma desde el link, sin cuenta.
- **Saldos netos por persona**: si Ana te debe $5 y tú le debes $12, se ve y se paga
  solo $7, de una vez.
- **Recordatorios amables** por WhatsApp y dentro de la app (uno cada 20 horas).
- **Avisos en vivo** (Supabase Realtime) y actividad.
- **Link de cobro** público (`/p/<código>`) para el "pásame tus datos".
- **Respaldo con correo** (código de 6 dígitos, sin contraseña) para recuperar la cuenta
  en otro celular.
- PWA instalable, modo oscuro, funciona en pantallas desde 320 px, accesible (AA).

## Stack

| Capa | Tecnología |
|---|---|
| App | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, React Router 7 (rutas diferidas) |
| Datos y sesiones | Supabase: Postgres + RLS, funciones `security definer`, Auth anónima + correo OTP, Realtime |
| PWA | vite-plugin-pwa (Workbox) |
| Métricas | Vercel Web Analytics (rutas sin códigos ni tokens) + tabla `mm_events` |
| Pruebas | Vitest (lógica), pruebas de base de datos sobre PostgreSQL real, Playwright (varios teléfonos a la vez) |

### Cómo está armado

```
Teléfono (PWA)                     Supabase
───────────────                    ──────────────────────────────────────────
React + Router  ──rpc('mm_*')──▶   funciones security definer (validan, bloquean
                                   la fila, escriben todo en una transacción)
                ◀──select (RLS)──  tablas de solo lectura: cada quien ve lo suyo
                ◀──realtime──────  mm_bills (versión de la cuenta) y mm_notifications
```

- **Toda escritura pasa por una función** `mm_*` (crear cuenta, unirse, marcar productos,
  dividir, avisar pagos…). Las tablas tienen RLS de solo lectura y no tienen permisos de
  escritura para nadie. Los errores salen como `mm:<código>` y la app los traduce
  ([`src/lib/errors.ts`](src/lib/errors.ts)).
- **Dinero en centavos enteros**, siempre. La división se calcula en el cliente con la
  misma lógica para todos ([`src/lib/split.ts`](src/lib/split.ts), con pruebas) y la
  base verifica al dividir que estén todos y que la suma sea exacta.
- **Concurrencia**: dividir exige la versión de la cuenta que se vio
  (`mm_lock_bill(p_version)`); si alguien entró o cambió algo justo antes, se avisa en
  vez de guardar algo viejo.
- **Un solo canal en vivo por cuenta**: cada cambio sube `mm_bills.version` y los
  teléfonos vuelven a pedir la foto completa. Si el canal se cae, se consulta cada pocos
  segundos.

## Poner en marcha (producción)

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **Authentication → Sign In / Providers**: activa **Allow anonymous sign-ins** y deja
   activo **Email**.
3. **Authentication → Emails → Templates**: para que llegue un código de 6 dígitos (y no
   solo un link), incluye `{{ .Token }}` en:
   - **Magic Link** (lo usa "Ya tengo cuenta"), por ejemplo:
     `Tu código para entrar a MitiMiti es {{ .Token }}`
   - **Change Email Address** (lo usa "Respalda tu cuenta"), por ejemplo:
     `Tu código para respaldar tu cuenta de MitiMiti es {{ .Token }}`
4. Para producción configura un **SMTP propio** (Authentication → Emails → SMTP
   Settings): el correo de prueba de Supabase tiene un límite muy bajo por hora.
5. **SQL Editor**: pega y ejecuta [`supabase/schema.sql`](supabase/schema.sql) completo.
   Se puede volver a correr cuando cambie (crea lo que falta y actualiza las funciones).
   También agrega `mm_bills` y `mm_notifications` a la publicación de Realtime.
6. **Project Settings → API**: copia la **Project URL** y la clave pública
   (**anon / publishable**). Nunca uses la `service_role` en la app.

### 2. Vercel

1. **Add New → Project** e importa este repositorio.
2. **Root Directory**: `mitimiti-app` (así convive con la app de Deuna de la raíz).
   Framework: Vite · Build: `npm run build` · Output: `dist`.
3. **Environment Variables**:

   | Variable | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://<tu-proyecto>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | la clave pública |
   | `VITE_APP_URL` | opcional: el dominio con el que se comparten los links (p. ej. `https://mitimiti.app`) |

4. Activa **Analytics** en el proyecto de Vercel (las rutas llegan agrupadas, como
   `/c/[codigo]`: los códigos y tokens nunca salen de la app).
5. En Supabase, **Authentication → URL Configuration**: pon tu dominio en **Site URL**.

[`vercel.json`](vercel.json) ya trae la reescritura a `index.html` (rutas de la app), caché
larga para `/assets` y cabeceras de seguridad.

## Desarrollo local

```bash
cd mitimiti-app
npm install
cp .env.example .env.local   # y completa con tu proyecto de Supabase
npm run dev                  # http://localhost:5180
```

### Sin Supabase: backend local

Para desarrollar y probar sin conexión hay un backend local que imita a Supabase sobre un
**PostgreSQL 16 real** con el mismo `schema.sql`, las mismas reglas (RLS, permisos,
funciones) y el mismo protocolo de tiempo real:
[`tests/backend/gateway.mjs`](tests/backend/gateway.mjs) (auth anónima y por código, `rpc`,
Realtime por WebSocket). No es para producción.

```bash
# PostgreSQL 16 escuchando en 127.0.0.1:54329 con el usuario postgres, por ejemplo:
#   initdb -D ~/mm-pg -U postgres && pg_ctl -D ~/mm-pg -o "-p 54329 -c wal_level=logical" start
npm run backend:local        # http://127.0.0.1:54321, imprime la URL y la clave pública
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=<la clave impresa> npm run dev
```

El backend local guarda los códigos de correo en memoria:
`GET http://127.0.0.1:54321/__test/otp?email=tu@correo.com`. Otra base:
`MM_GATEWAY_DB=...`; conservar los datos al reiniciar: `MM_GATEWAY_KEEP=1`.
La conexión de administración se puede cambiar con `MM_PG_ADMIN_URL`.

## Pruebas

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # lógica pura: dinero, división (incluye 3.000 casos al azar), saldos
npm run db:test      # base de datos: RLS, permisos, división, netos, links, recordatorios
npm run test:e2e     # Playwright: varios teléfonos a la vez contra el backend local
```

`db:test` y `test:e2e` necesitan el PostgreSQL local de arriba. `test:e2e` levanta solo el
backend local y la app (puerto 5190). Lo que cubren las pruebas de punta a punta:

- dividir en partes iguales con tres teléfonos, avisar el pago por Deuna, confirmarlo y
  anotar uno en efectivo hasta "¡Cuentas claras!";
- dividir por productos con alguien sin celular, y que su familia reclame su parte por link;
- préstamos: aceptar, pagar y confirmar; deudas en los dos sentidos (solo el neto); decir
  "no reconozco esta deuda" sin tener la app;
- respaldar con correo y recuperar todo en otro celular; código equivocado; link de cobro
  público con copiar; modo oscuro.

## Estructura

```
mitimiti-app/
├── src/
│   ├── features/        pantallas por tema (bill, debts, home, onboarding, profile, activity)
│   ├── lib/             lógica sin React: dinero, división, saldos, API, mensajes, errores
│   ├── state/           sesión, avisos en vivo, tema
│   ├── hooks/           useBill (cuenta en vivo), useData, useInstall, useOnline
│   ├── ui/              componentes base (botones, hojas, teclado numérico, avisos…)
│   ├── routes.tsx       rutas (las pantallas grandes se cargan al abrirlas)
│   └── index.css        tokens de diseño (claro/oscuro) y animaciones
├── supabase/            schema.sql (todo el backend) y metrics.sql
├── tests/
│   ├── backend/         backend local (gateway), pruebas de base de datos
│   └── e2e/             Playwright
├── docs/                producto y diseño
└── scripts/             generación de íconos e imagen para compartir
```

## Privacidad y seguridad

- Cada quien ve solo sus cuentas, las personas con las que comparte algo y sus propias
  deudas y avisos (RLS). Los datos de cobro solo los ve quien te debe o comparte una
  cuenta contigo, o quien abre tu link de cobro.
- Los links de cuentas (`/c/<código>`) muestran una vista previa mínima (título, total,
  quién invita); para ver más hay que entrar con un nombre. Los links de deudas usan
  tokens de 12 caracteres y quedan atados a la primera persona que los acepta.
- Sin contraseñas: sesión anónima en el teléfono y, si se quiere, respaldo con un código
  al correo.
- Las métricas no incluyen montos de terceros, nombres ni códigos de acceso.
