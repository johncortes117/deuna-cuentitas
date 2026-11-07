// Supabase local para pruebas de MitiMiti, sobre un PostgreSQL real:
//   • /auth/v1     sesiones anónimas, refresco de token, correo con código (OTP)
//   • /rest/v1/rpc llamadas a las funciones mm_* con el rol y el usuario del JWT,
//                  así las reglas (RLS, permisos, validaciones) son las reales
//   • /realtime/v1 cambios de mm_bills y mm_notifications por WebSocket, con el
//                  mismo protocolo que usa @supabase/realtime-js
//
// No reemplaza a Supabase en producción: existe para que las pruebas de punta
// a punta (y el desarrollo sin conexión) usen la misma base y las mismas reglas.
//
// Uso: node tests/backend/gateway.mjs   (MM_GATEWAY_KEEP=1 conserva los datos)
import http from 'node:http'
import pg from 'pg'
import { WebSocketServer } from 'ws'
import { randomUUID, randomInt, randomBytes } from 'node:crypto'
import { resetDatabase, urlFor, withIdentity, callRpc } from './db.mjs'
import { GATEWAY_PORT, ANON_KEY, signJwt, verifyJwt } from './local-config.mjs'

const DB = process.env.MM_GATEWAY_DB || 'mm_e2e'
if (!process.env.MM_GATEWAY_KEEP) await resetDatabase(DB)
const pool = new pg.Pool({ connectionString: urlFor(DB), max: 20 })

// ─── Auth ────────────────────────────────────────────────────

const refreshTokens = new Map() // refresh_token → user id
const otps = new Map()          // email → { token, userId, type }

async function loadUser(id) {
  const { rows } = await pool.query('select * from auth.users where id = $1', [id])
  return rows[0] ?? null
}

function userJson(u) {
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email ?? '',
    phone: '',
    is_anonymous: u.is_anonymous,
    app_metadata: { provider: u.is_anonymous ? 'anonymous' : 'email', providers: u.is_anonymous ? [] : ['email'] },
    user_metadata: u.raw_user_meta_data ?? {},
    identities: [],
    new_email: u.new_email ?? undefined,
    created_at: u.created_at,
    updated_at: new Date().toISOString(),
  }
}

function sessionFor(u) {
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = 3600
  const access = signJwt({
    iss: 'mitimiti-local', aud: 'authenticated', role: 'authenticated', sub: u.id,
    email: u.email ?? '', is_anonymous: u.is_anonymous, session_id: randomUUID(),
    iat: now, exp: now + expiresIn,
  })
  const refresh = randomBytes(24).toString('base64url')
  refreshTokens.set(refresh, u.id)
  return { access_token: access, token_type: 'bearer', expires_in: expiresIn, expires_at: now + expiresIn, refresh_token: refresh, user: userJson(u) }
}

function authError(res, status, code, msg) {
  send(res, status, { code: status, error_code: code, msg })
}

async function handleAuth(req, res, path, body) {
  if (path === '/signup' && req.method === 'POST') {
    if (body.email || body.phone) return authError(res, 422, 'signup_disabled', 'Solo sesiones anónimas en el backend local')
    const id = randomUUID()
    await pool.query('insert into auth.users (id, raw_user_meta_data) values ($1, $2)', [id, body.data ?? {}])
    return send(res, 200, sessionFor(await loadUser(id)))
  }
  if (path === '/token' && req.method === 'POST') {
    const userId = refreshTokens.get(body.refresh_token)
    if (!userId) return authError(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found')
    refreshTokens.delete(body.refresh_token)
    return send(res, 200, sessionFor(await loadUser(userId)))
  }
  if (path === '/logout') return send(res, 204, null)

  if (path === '/otp' && req.method === 'POST') {
    const email = String(body.email || '').toLowerCase()
    const { rows } = await pool.query('select id from auth.users where email = $1', [email])
    if (!rows[0] && body.create_user === false) return authError(res, 422, 'otp_disabled', 'Signups not allowed for otp')
    otps.set(email, { token: String(randomInt(100000, 999999)), userId: rows[0]?.id, type: 'email' })
    return send(res, 200, {})
  }
  if (path === '/verify' && req.method === 'POST') {
    const email = String(body.email || '').toLowerCase()
    const pending = otps.get(email)
    if (!pending || pending.token !== String(body.token) || (body.type === 'email_change') !== (pending.type === 'email_change')) {
      return authError(res, 403, 'otp_expired', 'Token has expired or is invalid')
    }
    otps.delete(email)
    if (pending.type === 'email_change') {
      await pool.query('update auth.users set email = $2, is_anonymous = false where id = $1', [pending.userId, email])
    }
    return send(res, 200, sessionFor(await loadUser(pending.userId)))
  }

  if (path === '/user') {
    const claims = verifyJwt((req.headers.authorization || '').replace(/^Bearer /i, ''))
    if (!claims?.sub) return authError(res, 401, 'bad_jwt', 'invalid JWT')
    const u = await loadUser(claims.sub)
    if (!u) return authError(res, 404, 'user_not_found', 'User not found')
    if (req.method === 'PUT' && body.email) {
      const email = String(body.email).toLowerCase()
      const { rows } = await pool.query('select 1 from auth.users where email = $1 and id <> $2', [email, u.id])
      if (rows[0]) return authError(res, 422, 'email_exists', 'A user with this email address has already been registered')
      otps.set(email, { token: String(randomInt(100000, 999999)), userId: u.id, type: 'email_change' })
      return send(res, 200, { ...userJson(u), new_email: email, email_change_sent_at: new Date().toISOString() })
    }
    return send(res, 200, userJson(u))
  }
  return authError(res, 404, 'not_found', `auth: ${req.method} ${path} no está en el backend local`)
}

// ─── REST (solo funciones) ───────────────────────────────────

function claimsFrom(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer /i, '') || req.headers.apikey
  const claims = verifyJwt(token)
  if (!claims) return { error: true }
  return claims.role === 'authenticated' && claims.sub ? claims : null
}

async function handleRest(req, res, path, body) {
  const match = path.match(/^\/rpc\/([a-z_]+)$/)
  if (!match || req.method !== 'POST') {
    return send(res, 404, { code: 'PGRST125', message: 'El backend local solo expone /rpc/<función>' })
  }
  const claims = claimsFrom(req)
  if (claims?.error) return send(res, 401, { code: 'PGRST301', message: 'JWT inválido o vencido' })
  try {
    const result = await withIdentity(pool, claims, (c) => callRpc(c, match[1], body ?? {}))
    return send(res, 200, result ?? null)
  } catch (err) {
    const status = err.code === '42501' ? 403 : err.code === 'PGRST202' || err.code === '42883' ? 404 : 400
    return send(res, status, { code: err.code ?? 'P0001', message: err.message, details: err.detail ?? null, hint: err.hint ?? null })
  }
}

// ─── HTTP ────────────────────────────────────────────────────

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version, prefer, accept-profile, content-profile, x-retry-count',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-max-age': '86400',
}

function send(res, status, payload) {
  res.writeHead(status, { ...CORS, ...(payload === null && status === 204 ? {} : { 'content-type': 'application/json' }) })
  res.end(status === 204 ? undefined : JSON.stringify(payload))
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    return res.end()
  }
  const url = new URL(req.url, 'http://localhost')
  let raw = ''
  for await (const chunk of req) raw += chunk
  let body = {}
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch {
    return send(res, 400, { message: 'JSON inválido' })
  }
  try {
    if (url.pathname.startsWith('/auth/v1')) return await handleAuth(req, res, url.pathname.slice(8), body)
    if (url.pathname.startsWith('/rest/v1')) return await handleRest(req, res, url.pathname.slice(8), body)
    if (url.pathname === '/__test/otp') return send(res, 200, otps.get(String(url.searchParams.get('email')).toLowerCase()) ?? null)
    if (url.pathname === '/__test/health') return send(res, 200, { ok: true, db: DB })
    if (url.pathname === '/__test/sql' && req.method === 'POST') {
      // Solo para preparar escenarios en las pruebas (p. ej. fechas viejas).
      const { rows } = await pool.query(body.sql, body.params ?? [])
      return send(res, 200, rows)
    }
    return send(res, 404, { message: 'not found' })
  } catch (err) {
    console.error(err)
    return send(res, 500, { message: err.message })
  }
})

// ─── Realtime (postgres_changes) ─────────────────────────────

// Avisos de la base: un disparador manda cada cambio por NOTIFY.
const setup = await pool.connect()
await setup.query(`
  create or replace function public.mm_test_realtime() returns trigger language plpgsql as $$
  begin
    perform pg_notify('mm_realtime', json_build_object(
      'table', tg_table_name, 'type', tg_op,
      'record', row_to_json(new), 'old', case when tg_op = 'UPDATE' then row_to_json(old) end
    )::text);
    return new;
  end $$;
  drop trigger if exists mm_rt on public.mm_bills;
  create trigger mm_rt after insert or update on public.mm_bills for each row execute function public.mm_test_realtime();
  drop trigger if exists mm_rt on public.mm_notifications;
  create trigger mm_rt after insert on public.mm_notifications for each row execute function public.mm_test_realtime();
`)
const columns = {}
for (const table of ['mm_bills', 'mm_notifications']) {
  const { rows } = await setup.query(
    `select column_name as name, udt_name as type from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position`,
    [table],
  )
  columns[table] = rows
}
setup.release()

const sockets = new Set()
const wss = new WebSocketServer({ noServer: true })
let nextBindingId = 1

server.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith('/realtime/v1/websocket')) return socket.destroy()
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.channels = new Map() // topic → { joinRef, bindings, claims }
    sockets.add(ws)
    ws.on('close', () => sockets.delete(ws))
    ws.on('message', (data) => {
      let msg
      try {
        msg = JSON.parse(String(data))
      } catch {
        return
      }
      const [joinRef, ref, topic, event, payload] = msg
      const reply = (response = {}, status = 'ok') => ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status, response }]))
      if (topic === 'phoenix' && event === 'heartbeat') return reply()
      if (event === 'phx_join') {
        const claims = verifyJwt(payload?.access_token) ?? verifyJwt(ANON_KEY)
        const bindings = (payload?.config?.postgres_changes ?? []).map((b) => ({ ...b, id: nextBindingId++ }))
        ws.channels.set(topic, { joinRef, bindings, claims })
        reply({ postgres_changes: bindings })
        ws.send(JSON.stringify([joinRef, null, topic, 'system', { message: 'Subscribed to PostgreSQL', status: 'ok', extension: 'postgres_changes', channel: topic.replace(/^realtime:/, '') }]))
        return
      }
      if (event === 'access_token') {
        const ch = ws.channels.get(topic)
        const claims = verifyJwt(payload?.access_token)
        if (ch && claims) ch.claims = claims
        return
      }
      if (event === 'phx_leave') {
        ws.channels.delete(topic)
        return reply()
      }
      reply()
    })
  })
})

function matchesFilter(filter, record) {
  if (!filter) return true
  const m = filter.match(/^([a-z_]+)=eq\.(.+)$/)
  return m ? String(record?.[m[1]]) === m[2] : false
}

const listener = new pg.Client({ connectionString: urlFor(DB) })
await listener.connect()
await listener.query('listen mm_realtime')
listener.on('notification', async (n) => {
  const change = JSON.parse(n.payload)
  for (const ws of sockets) {
    for (const [topic, ch] of ws.channels) {
      for (const b of ch.bindings) {
        if (b.table !== change.table || (b.event !== '*' && b.event !== change.type) || !matchesFilter(b.filter, change.record)) continue
        // Igual que Supabase: solo llega si la persona puede leer esa fila (RLS).
        const claims = ch.claims?.role === 'authenticated' ? ch.claims : null
        const visible = await withIdentity(pool, claims, (c) =>
          c.query(`select 1 from public.${change.table} where id = $1`, [change.record.id]).then((r) => r.rowCount > 0),
        ).catch(() => false)
        if (!visible || ws.readyState !== ws.OPEN) continue
        ws.send(JSON.stringify([ch.joinRef, null, topic, 'postgres_changes', {
          ids: [b.id],
          data: {
            schema: 'public', table: change.table, commit_timestamp: new Date().toISOString(), type: change.type,
            columns: columns[change.table], record: change.record, old_record: change.old ?? {}, errors: null,
          },
        }]))
      }
    }
  }
})

server.listen(GATEWAY_PORT, '127.0.0.1', () => {
  console.log(`MitiMiti · backend local listo en http://127.0.0.1:${GATEWAY_PORT} (base ${DB})`)
  console.log(`VITE_SUPABASE_URL=http://127.0.0.1:${GATEWAY_PORT}`)
  console.log(`VITE_SUPABASE_ANON_KEY=${ANON_KEY}`)
})
