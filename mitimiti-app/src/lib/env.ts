// Configuración que llega en el build (Vercel → Settings → Environment Variables).
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

/** Dominio público para los links que se comparten. */
export const APP_URL = ((import.meta.env.VITE_APP_URL as string | undefined)?.trim() || window.location.origin).replace(/\/$/, '')
