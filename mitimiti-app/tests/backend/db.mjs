// Utilidades para levantar una base de prueba con el esquema de MitiMiti sobre
// un PostgreSQL local, y para ejecutar consultas "como" una persona (con su
// sesión), igual que lo haría Supabase: rol authenticated/anon + claims del JWT.
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
export const appRoot = join(here, '..', '..')

export const ADMIN_URL = process.env.MM_PG_ADMIN_URL || 'postgres://postgres@127.0.0.1:54329/postgres'

export function urlFor(database) {
  const u = new URL(ADMIN_URL)
  u.pathname = `/${database}`
  return u.toString()
}

// Crea (o recrea) la base y aplica el "shim" de Supabase + supabase/schema.sql.
export async function resetDatabase(database) {
  const admin = new pg.Client({ connectionString: ADMIN_URL })
  await admin.connect()
  await admin.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`, [database])
  await admin.query(`drop database if exists ${database}`)
  await admin.query(`create database ${database}`)
  await admin.end()

  const db = new pg.Client({ connectionString: urlFor(database) })
  await db.connect()
  await db.query('set client_min_messages = warning')
  await db.query(readFileSync(join(here, 'supabase-shim.sql'), 'utf8'))
  await db.query(readFileSync(join(appRoot, 'supabase', 'schema.sql'), 'utf8'))
  await db.end()
}

// Llama a una función del esquema con argumentos con nombre, como lo hace
// PostgREST con supabase.rpc(). Lee la firma de la función para convertir cada
// argumento a su tipo (jsonb, uuid[], integer…).
const signatures = new Map()
export async function callRpc(client, name, args = {}) {
  if (!/^mm_[a-z_]+$/.test(name)) throw Object.assign(new Error(`function ${name} not allowed`), { code: '42883' })
  let sig = signatures.get(name)
  if (!sig) {
    const { rows } = await client.query(
      `select p.proargnames as names, (select array_agg(format_type(t, null) order by ord)
         from unnest(p.proargtypes) with ordinality as a(t, ord)) as types
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = $1`,
      [name],
    )
    if (rows.length !== 1) throw Object.assign(new Error(`Could not find the function public.${name}`), { code: 'PGRST202' })
    sig = { names: rows[0].names ?? [], types: rows[0].types ?? [] }
    signatures.set(name, sig)
  }
  const parts = []
  const values = []
  for (const [key, value] of Object.entries(args)) {
    const i = sig.names.indexOf(key)
    if (i < 0) throw Object.assign(new Error(`Could not find the function public.${name}(${key})`), { code: 'PGRST202' })
    const type = sig.types[i]
    values.push(value === null || value === undefined ? null : type === 'jsonb' || type === 'json' ? JSON.stringify(value) : value)
    parts.push(`${key} => $${values.length}::${type}`)
  }
  const { rows } = await client.query(`select public.${name}(${parts.join(', ')}) as r`, values)
  const r = rows[0]?.r
  return r === '' ? null : r
}

// Ejecuta fn(client) dentro de una transacción con la identidad indicada.
// claims = null → rol anon (sin sesión).
export async function withIdentity(pool, claims, fn) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(`set local role ${claims ? 'authenticated' : 'anon'}`)
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims ?? { role: 'anon' })])
    if (claims?.sub) await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [claims.sub])
    const out = await fn(client)
    await client.query('commit')
    return out
  } catch (err) {
    await client.query('rollback').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
