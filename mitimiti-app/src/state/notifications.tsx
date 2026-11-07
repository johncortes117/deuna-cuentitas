// ─── Notificaciones en vivo ──────────────────────────────────
// "Ana dice que te pagó $12", "Pedro dividió la cuenta": llegan por tiempo
// real (Supabase Realtime) en cualquier pantalla. Si el canal se cae (red
// móvil, teléfono bloqueado), se consulta cada pocos segundos: nunca se
// pierde un aviso. Las pantallas escuchan `signal` para volver a cargar.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { notificationCopy } from '../lib/notificationCopy'
import type { AppNotification } from '../lib/types'
import { useToast } from '../ui/Toast'
import { tap } from '../ui/haptics'
import { useSession } from './session'

interface NotificationsValue {
  unread: number
  toConfirm: number
  /** Sube cada vez que llega algo nuevo: las pantallas lo usan para recargar. */
  signal: number
  refresh: () => void
  markAllRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsValue>({
  unread: 0,
  toConfirm: 0,
  signal: 0,
  refresh: () => {},
  markAllRead: async () => {},
})

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { userId, profile } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const [toConfirm, setToConfirm] = useState(0)
  const [signal, setSignal] = useState(0)
  const lastId = useRef<number | null>(null)
  const live = useRef(false)

  const refreshCounts = useCallback(async () => {
    try {
      const home = await api.home()
      setUnread(home.unread)
      setToConfirm(home.to_confirm)
    } catch {
      // Se reintenta en la próxima señal.
    }
  }, [])

  const announce = useCallback(
    (n: AppNotification) => {
      // "Todos te pagaron" llega por tu propio "Recibido": esa pantalla ya lo
      // celebra. Queda en Actividad, sin aviso encima.
      if (n.kind === 'bill_settled') return
      const c = notificationCopy(n)
      const here = window.location.pathname === c.href
      tap(12)
      toast({ title: c.title, body: c.body, emoji: c.emoji, tone: c.tone, action: here ? undefined : { label: 'Ver', onClick: () => navigate(c.href) } })
    },
    [toast, navigate],
  )

  // Revisa si hay avisos nuevos (al volver a la app o si el tiempo real cayó).
  const poll = useCallback(async () => {
    try {
      const list = await api.notifications(10)
      const newest = list[0]?.id ?? 0
      if (lastId.current === null) {
        lastId.current = newest
        return
      }
      const fresh = list.filter((n) => n.id > (lastId.current ?? 0)).reverse()
      if (fresh.length === 0) return
      lastId.current = newest
      fresh.slice(-2).forEach(announce)
      setSignal((s) => s + 1)
      void refreshCounts()
    } catch {
      // Sin conexión: el siguiente intento lo resuelve.
    }
  }, [announce, refreshCounts])

  useEffect(() => {
    if (!userId || !profile) return
    lastId.current = null
    // La primera revisión sale en el siguiente ciclo: el efecto solo la agenda.
    const first = window.setTimeout(() => {
      void poll()
      void refreshCounts()
    }, 0)

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mm_notifications', filter: `user_id=eq.${userId}` }, (payload) => {
        const n = payload.new as AppNotification
        if (lastId.current !== null && n.id <= lastId.current) return
        lastId.current = n.id
        announce(n)
        setSignal((s) => s + 1)
        void refreshCounts()
      })
      .subscribe((status) => {
        live.current = status === 'SUBSCRIBED'
      })

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !live.current) void poll()
    }, 8000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void poll()
        setSignal((s) => s + 1)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)

    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
      void supabase.removeChannel(channel)
    }
  }, [userId, profile, poll, refreshCounts, announce])

  const markAllRead = useCallback(async () => {
    setUnread(0)
    try {
      await api.markRead()
    } catch {
      void refreshCounts()
    }
  }, [refreshCounts])

  const refresh = useCallback(() => {
    setSignal((s) => s + 1)
    void refreshCounts()
  }, [refreshCounts])

  const value = useMemo(() => ({ unread, toConfirm, signal, refresh, markAllRead }), [unread, toConfirm, signal, refresh, markAllRead])
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => useContext(NotificationsContext)
