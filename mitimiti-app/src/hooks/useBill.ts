// ─── Una cuenta en vivo ──────────────────────────────────────
// Un solo canal de tiempo real por cuenta: la base sube la versión de la
// cuenta con cada cambio (alguien entró, marcó un producto, pagó) y aquí se
// vuelve a pedir la foto completa. Si el canal se cae, se consulta cada
// pocos segundos; al volver a la app, al instante.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { ApiError } from '../lib/errors'
import { distinctColors } from '../lib/avatar'
import type { BillBundle } from '../lib/types'

/** Colores únicos por mesa (también para quien pagó). */
function withTableColors(b: BillBundle): BillBundle {
  const members = distinctColors(b.members)
  const payerColor = b.payer ? members.find((m) => m.id === b.payer?.member_id)?.color : undefined
  return { ...b, members, payer: b.payer && payerColor !== undefined ? { ...b.payer, color: payerColor } : b.payer }
}

export function useBill(code: string, enabled: boolean) {
  const [bundle, setBundle] = useState<BillBundle | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [live, setLive] = useState(false)
  const version = useRef(0)
  const inflight = useRef(false)
  const queued = useRef(false)
  const refreshRef = useRef<() => Promise<void>>(async () => {})

  const refresh = useCallback(async () => {
    if (inflight.current) {
      queued.current = true
      return
    }
    inflight.current = true
    try {
      const next = await api.getBill(code)
      // Una respuesta vieja nunca pisa una más nueva.
      if (next.bill.version >= version.current) {
        version.current = next.bill.version
        setBundle(withTableColors(next))
      }
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('unknown', String(err)))
    } finally {
      inflight.current = false
      if (queued.current) {
        queued.current = false
        void refreshRef.current()
      }
    }
  }, [code])

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    if (!enabled) return
    version.current = 0
    // La primera carga sale en el siguiente ciclo: el efecto solo la agenda.
    const first = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(first)
  }, [enabled, refresh])

  const billId = bundle?.bill.id
  useEffect(() => {
    if (!enabled || !billId) return
    const channel = supabase
      .channel(`bill:${billId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mm_bills', filter: `id=eq.${billId}` }, () => {
        void refreshRef.current()
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    return () => {
      void supabase.removeChannel(channel)
      setLive(false)
    }
  }, [enabled, billId])

  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshRef.current()
    }, live ? 25000 : 4000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshRef.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [enabled, live])

  /** Cambio local inmediato (p. ej. marcar un producto) mientras va al servidor. */
  const mutate = useCallback((update: (b: BillBundle) => BillBundle) => {
    setBundle((b) => (b ? update(b) : b))
  }, [])

  return { bundle, error, live, refresh, mutate }
}
