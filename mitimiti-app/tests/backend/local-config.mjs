// Configuración compartida del backend local de pruebas (gateway + app + E2E).
import { createHmac } from 'node:crypto'

export const GATEWAY_PORT = Number(process.env.MM_GATEWAY_PORT || 54321)
export const GATEWAY_URL = `http://127.0.0.1:${GATEWAY_PORT}`
export const JWT_SECRET = 'mitimiti-local-test-secret-not-for-production'

const b64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')

// JWT HS256, igual al que firma Supabase Auth (y que la app solo decodifica).
export function signJwt(claims) {
  const head = b64url({ alg: 'HS256', typ: 'JWT' })
  const body = b64url(claims)
  const sig = createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}

export function verifyJwt(token) {
  const [head, body, sig] = String(token || '').split('.')
  if (!head || !body || !sig) return null
  const expected = createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url')
  if (expected !== sig) return null
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  if (claims.exp && claims.exp * 1000 < Date.now()) return null
  return claims
}

// Clave pública (anon) fija: el mismo valor que usa la app en las pruebas.
export const ANON_KEY = signJwt({ iss: 'mitimiti-local', role: 'anon', iat: 1767225600, exp: 2082758400 })
