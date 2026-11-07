// ─── Actividad: lo que pasó en tus cuentas ───────────────────
import { useEffect } from 'react'
import { Link } from 'react-router'
import { useNotifications } from '../../state/notifications'
import { useData } from '../../hooks/useData'
import { api } from '../../lib/api'
import { notificationCopy } from '../../lib/notificationCopy'
import { timeAgo } from '../../lib/dates'
import { Card, EmptyState, Page, Skeleton, TopBar } from '../../ui/Layout'
import { cx } from '../../ui/cx'

export default function ActivityPage() {
  const { signal, markAllRead } = useNotifications()
  const { data, loading } = useData(() => api.notifications(60), String(signal))

  // Al abrir Actividad todo queda leído (el punto rojo del inicio se apaga).
  useEffect(() => {
    void markAllRead()
  }, [markAllRead, signal])

  return (
    <>
      <TopBar back="/" title="Actividad" />
      <Page className="pt-2">
        {loading && !data ? (
          <Skeleton className="h-72 rounded-3xl" />
        ) : !data || data.length === 0 ? (
          <EmptyState emoji="🔔" title="Todavía no pasa nada" body="Aquí verás cuando te paguen, cuando dividan una cuenta en la que estás y los recordatorios." />
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {data.map((n) => {
                const c = notificationCopy(n)
                return (
                  <li key={n.id}>
                    <Link to={c.href} className={cx('flex items-start gap-3 px-4 py-3.5 hover:bg-surface-2', !n.read_at && 'bg-brand-soft/40')}>
                      <span
                        className={cx(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[18px]',
                          c.tone === 'good' ? 'bg-positive-soft' : c.tone === 'warn' ? 'bg-warning-soft' : 'bg-surface-2',
                        )}
                        aria-hidden="true"
                      >
                        {c.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold leading-snug text-ink">{c.title}</span>
                        {c.body && <span className="mt-0.5 block text-[13.5px] leading-snug text-muted">{c.body}</span>}
                        <span className="mt-1 block text-[12.5px] text-subtle">{timeAgo(n.created_at)}</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </Page>
    </>
  )
}
