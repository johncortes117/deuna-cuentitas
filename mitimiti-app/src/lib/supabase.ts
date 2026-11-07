import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL, isConfigured } from './env'

// Sesión guardada en el teléfono: quien abre la app queda con su usuario
// (anónimo hasta que lo respalde con su correo) aunque cierre el navegador.
export const supabase = createClient(
  isConfigured ? SUPABASE_URL : 'http://localhost:54321',
  isConfigured ? SUPABASE_ANON_KEY : 'not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'mitimiti-auth',
    },
    realtime: { params: { eventsPerSecond: 10 } },
  },
)
