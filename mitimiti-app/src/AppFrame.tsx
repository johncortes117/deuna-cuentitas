// ─── Marco de la app ─────────────────────────────────────────
// Columna de teléfono centrada (en computador también), avisos de conexión,
// notificaciones en vivo y métricas de páginas sin datos sensibles.
import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { Analytics } from '@vercel/analytics/react'
import { WifiOff } from 'lucide-react'
import { NotificationsProvider } from './state/notifications'
import { useSession } from './state/session'
import { useOnline } from './hooks/useOnline'
import { isConfigured } from './lib/env'
import { BottomNav } from './ui/BottomNav'
import { LogoMark } from './ui/Logo'

// /c/K7Q2PX → /c/[codigo]: las visitas se agrupan por pantalla y los
// códigos y tokens (que dan acceso) nunca salen de la app.
function routeFor(pathname: string): string {
  return pathname
    .replace(/^\/c\/[^/]+/, '/c/[codigo]')
    .replace(/^\/d\/[^/]+/, '/d/[token]')
    .replace(/^\/p\/[^/]+/, '/p/[codigo]')
    .replace(/^\/saldos\/(?!historial$)[^/]+/, '/saldos/[persona]')
}

function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-ink px-4 py-2 text-[13px] font-semibold text-on-ink" role="status">
      <WifiOff size={15} aria-hidden="true" /> Sin conexión: los cambios se verán cuando vuelva el internet.
    </div>
  )
}

export function Splash() {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center" aria-busy="true" aria-label="Cargando">
      <LogoMark size={56} className="animate-pulse text-ink" />
    </div>
  )
}

function NotConfigured() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
      <LogoMark size={56} className="mb-6 text-ink" />
      <h1 className="text-[22px] font-bold text-ink">Falta conectar la base de datos</h1>
      <p className="mt-2 text-[15px] text-muted">
        Define <code className="rounded bg-surface-2 px-1.5 py-0.5">VITE_SUPABASE_URL</code> y{' '}
        <code className="rounded bg-surface-2 px-1.5 py-0.5">VITE_SUPABASE_ANON_KEY</code> (ver README de mitimiti-app).
      </p>
    </div>
  )
}

export function AppFrame() {
  const location = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  if (!isConfigured) return <NotConfigured />
  const route = routeFor(location.pathname)
  return (
    <NotificationsProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-bg sm:border-x sm:border-line">
        <OfflineBanner />
        <Outlet />
      </div>
      {import.meta.env.PROD && <Analytics route={route} path={route} />}
    </NotificationsProvider>
  )
}

/** Pantallas que necesitan saber quién eres; si no, primero tu nombre. */
export function RequireProfile() {
  const { ready, profile } = useSession()
  const location = useLocation()
  if (!ready) return <Splash />
  if (!profile) return <Navigate to={`/bienvenida?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <Outlet />
}

/** Las tres pestañas principales llevan la barra de abajo. */
export function TabsLayout() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  )
}
