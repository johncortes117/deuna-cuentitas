// ─── Sesión ──────────────────────────────────────────────────
// Nadie se registra para usar MitiMiti: al decir tu nombre se crea una sesión
// anónima en Supabase (un usuario real, con sus reglas de seguridad) y queda
// guardada en el teléfono. Si quieres no perderla al cambiar de celular, la
// respaldas con tu correo (un código de 6 dígitos, sin contraseñas).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { ApiError, toApiError } from '../lib/errors'
import { isConfigured } from '../lib/env'
import type { PayMethod, Profile } from '../lib/types'

interface SessionValue {
  ready: boolean
  userId: string | null
  email: string | null
  isAnonymous: boolean
  profile: Profile | null
  /** Crea la sesión si no hay y guarda el nombre. */
  start: (name: string) => Promise<Profile>
  saveProfile: (name: string, payMethods?: PayMethod[]) => Promise<Profile>
  reload: () => Promise<void>
  requestBackupCode: (email: string) => Promise<void>
  confirmBackupCode: (email: string, code: string) => Promise<void>
  requestRestoreCode: (email: string) => Promise<void>
  confirmRestoreCode: (email: string, code: string) => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

const CACHE_KEY = 'mitimiti-profile'

function readCache(): Profile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}

function writeCache(p: Profile | null) {
  try {
    if (p) localStorage.setItem(CACHE_KEY, JSON.stringify(p))
    else localStorage.removeItem(CACHE_KEY)
  } catch {
    // Sin almacenamiento (modo privado): la app sigue, solo sin caché.
  }
}

function authError(err: { message?: string; code?: string; status?: number } | null): ApiError {
  const msg = err?.message ?? ''
  if (/anonymous sign-ins are disabled/i.test(msg)) return new ApiError('anonymous_disabled', msg)
  if (/token has expired|invalid/i.test(msg) && /otp|token/i.test(msg)) return new ApiError('bad_code', msg)
  if (/signups not allowed|user not found/i.test(msg)) return new ApiError('no_account', msg)
  if (/already been registered|email_exists/i.test(msg)) return new ApiError('email_taken', msg)
  if (/rate limit|too many/i.test(msg)) return new ApiError('rate_limited', msg)
  return toApiError(err)
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isConfigured)
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(() => readCache())

  const loadProfile = useCallback(async () => {
    try {
      const me = await api.me()
      setProfile(me)
      writeCache(me)
    } catch (err) {
      // Sin conexión: se usa el perfil guardado. Con sesión inválida, nada.
      if (err instanceof ApiError && err.code !== 'network') {
        setProfile(null)
        writeCache(null)
      }
    }
  }, [])

  useEffect(() => {
    if (!isConfigured) return
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      const user = data.session?.user
      if (user) {
        setUserId(user.id)
        setEmail(user.email || null)
        setIsAnonymous(Boolean(user.is_anonymous))
        await loadProfile()
      } else {
        setProfile(null)
        writeCache(null)
      }
      if (alive) setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user
      setUserId(user?.id ?? null)
      setEmail(user?.email || null)
      setIsAnonymous(user ? Boolean(user.is_anonymous) : true)
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        writeCache(null)
      }
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const ensureUser = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session.user.id
    const { data: signed, error } = await supabase.auth.signInAnonymously()
    if (error || !signed.user) throw authError(error)
    setUserId(signed.user.id)
    setIsAnonymous(true)
    return signed.user.id
  }, [])

  const saveProfile = useCallback(async (name: string, payMethods?: PayMethod[]) => {
    const p = await api.saveProfile(name, payMethods)
    setProfile(p)
    writeCache(p)
    return p
  }, [])

  const start = useCallback(
    async (name: string) => {
      await ensureUser()
      return saveProfile(name)
    },
    [ensureUser, saveProfile],
  )

  const requestBackupCode = useCallback(async (address: string) => {
    const { error } = await supabase.auth.updateUser({ email: address.trim().toLowerCase() })
    if (error) throw authError(error)
  }, [])

  const confirmBackupCode = useCallback(async (address: string, code: string) => {
    const { data, error } = await supabase.auth.verifyOtp({ email: address.trim().toLowerCase(), token: code.trim(), type: 'email_change' })
    if (error) throw authError(error)
    const user = data.user ?? (await supabase.auth.getUser()).data.user
    setEmail(user?.email || address.trim().toLowerCase())
    setIsAnonymous(false)
  }, [])

  const requestRestoreCode = useCallback(async (address: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email: address.trim().toLowerCase(), options: { shouldCreateUser: false } })
    if (error) throw authError(error)
  }, [])

  const confirmRestoreCode = useCallback(
    async (address: string, code: string) => {
      const { data, error } = await supabase.auth.verifyOtp({ email: address.trim().toLowerCase(), token: code.trim(), type: 'email' })
      if (error || !data.user) throw authError(error)
      setUserId(data.user.id)
      setEmail(data.user.email || null)
      setIsAnonymous(false)
      await loadProfile()
    },
    [loadProfile],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    writeCache(null)
  }, [])

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      userId,
      email,
      isAnonymous,
      profile: userId ? profile : null,
      start,
      saveProfile,
      reload: loadProfile,
      requestBackupCode,
      confirmBackupCode,
      requestRestoreCode,
      confirmRestoreCode,
      signOut,
    }),
    [ready, userId, email, isAnonymous, profile, start, saveProfile, loadProfile, requestBackupCode, confirmBackupCode, requestRestoreCode, confirmRestoreCode, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession fuera de SessionProvider')
  return ctx
}
