// ─── Inicio ──────────────────────────────────────────────────
// Lo primero: cuánto te deben y cuánto debes, y el botón para dividir una
// cuenta. Debajo, las cuentas que están en curso con lo que falta en cada una.
import { Link, useNavigate } from 'react-router'
import { Bell, ChevronRight, HandCoins, Hash, Plus } from 'lucide-react'
import { useSession } from '../../state/session'
import { useNotifications } from '../../state/notifications'
import { useData } from '../../hooks/useData'
import { api } from '../../lib/api'
import { buildBalances } from '../../lib/ledger'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../lib/avatar'
import type { HomeBill } from '../../lib/types'
import { Card, EmptyState, Page, SectionTitle, Skeleton } from '../../ui/Layout'
import { LogoMark } from '../../ui/Logo'
import { StatusPill } from '../../ui/Controls'
import { cx } from '../../ui/cx'
import { titleEmoji } from '../shared/titles'

function billStatus(b: HomeBill): { text: string; tone: 'good' | 'warn' | 'muted' | 'info' } {
  if (b.status === 'settled') return { text: '¡Cuentas claras!', tone: 'good' }
  if (b.status === 'open') {
    if (b.is_host) return b.member_count < 2 ? { text: 'Esperando que se unan', tone: 'info' } : { text: `${b.member_count} personas · lista para dividir`, tone: 'info' }
    return { text: 'Esperando que se divida', tone: 'muted' }
  }
  if (b.i_am_payer && b.owed) {
    if (b.owed.reported > 0) return { text: `${b.owed.reported} por confirmar`, tone: 'warn' }
    return { text: `Faltan ${formatMoney(b.owed.pending_cents, b.currency)} · ${b.owed.done} de ${b.owed.done + b.owed.pending} pagaron`, tone: 'info' }
  }
  if (b.my_debt) {
    if (b.my_debt.status === 'reported') return { text: `Esperando que ${firstName(b.payer_name ?? '')} confirme`, tone: 'muted' }
    if (b.my_debt.status === 'settled' || b.my_debt.status === 'forgiven') return { text: 'Ya pagaste tu parte', tone: 'good' }
    return { text: `Le debes ${formatMoney(b.my_debt.amount_cents, b.currency)} a ${firstName(b.payer_name ?? '')}`, tone: 'warn' }
  }
  return { text: 'No te toca pagar', tone: 'muted' }
}

export default function HomePage() {
  const { profile } = useSession()
  const { signal, unread } = useNotifications()
  const navigate = useNavigate()
  const { data, loading } = useData(async () => {
    const [home, ledger] = await Promise.all([api.home(), api.ledger()])
    return { home, balances: buildBalances(ledger, profile!.id, profile!.color) }
  }, String(signal))

  const bills = data?.home.bills ?? []
  const b = data?.balances

  return (
    <>
      <header className="flex items-center justify-between px-5 pb-2 pt-safe">
        <div className="flex items-center gap-2.5 pt-3">
          <LogoMark size={30} className="text-ink" />
          <p className="text-[20px] font-bold tracking-[-0.02em] text-ink">Hola, {firstName(profile?.name ?? '')}</p>
        </div>
        <Link to="/actividad" aria-label={unread ? `Actividad, ${unread} sin leer` : 'Actividad'} className="relative mt-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-surface-2">
          <Bell size={23} />
          {unread > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-bg" aria-hidden="true" />}
        </Link>
      </header>

      <Page withNav className="pt-3">
        {/* Saldos */}
        {loading && !data ? (
          <Skeleton className="h-[104px] rounded-3xl" />
        ) : b && (b.owedToMe > 0 || b.iOwe > 0 || b.toConfirmCount > 0) ? (
          <Link to="/saldos" className="block rounded-3xl border border-line bg-surface shadow-card transition active:scale-[0.99]">
            <div className="grid grid-cols-2 divide-x divide-line">
              <div className="px-5 py-4">
                <p className="text-[13px] font-semibold text-muted">Te deben</p>
                <p className={cx('mt-0.5 text-[26px] font-extrabold tracking-[-0.03em] tabular', b.owedToMe > 0 ? 'text-positive' : 'text-subtle')}>{formatMoney(b.owedToMe)}</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[13px] font-semibold text-muted">Debes</p>
                <p className={cx('mt-0.5 text-[26px] font-extrabold tracking-[-0.03em] tabular', b.iOwe > 0 ? 'text-ink' : 'text-subtle')}>{formatMoney(b.iOwe)}</p>
              </div>
            </div>
            {b.toConfirmCount > 0 && (
              <div className="flex items-center justify-between rounded-b-3xl border-t border-line bg-warning-soft px-5 py-3 text-[14px] font-semibold text-warning">
                {b.toConfirmCount === 1 ? 'Tienes 1 pago por confirmar' : `Tienes ${b.toConfirmCount} pagos por confirmar`}
                <ChevronRight size={18} aria-hidden="true" />
              </div>
            )}
          </Link>
        ) : (
          <Card className="flex items-center gap-3 px-5 py-4">
            <span className="text-[26px]" aria-hidden="true">🎉</span>
            <div>
              <p className="text-[16px] font-bold text-ink">Estás al día</p>
              <p className="text-[14px] text-muted">Nadie te debe y no le debes a nadie.</p>
            </div>
          </Card>
        )}

        {/* Acción principal */}
        <button
          type="button"
          onClick={() => navigate('/nueva')}
          className="mt-4 flex w-full items-center gap-4 rounded-3xl bg-ink px-5 py-5 text-left text-on-ink shadow-[0_12px_28px_rgb(23_21_31/0.22)] transition active:scale-[0.99]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white" aria-hidden="true">
            <Plus size={28} strokeWidth={2.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[19px] font-bold tracking-[-0.02em]">Dividir una cuenta</span>
            <span className="block text-[14px] opacity-75">Crea la cuenta y comparte el link</span>
          </span>
          <ChevronRight size={22} aria-hidden="true" className="opacity-70" />
        </button>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Link to="/prestamo" className="flex flex-col gap-2 rounded-3xl border border-line bg-surface px-4 py-4 shadow-card transition active:scale-[0.98]">
            <HandCoins size={24} className="text-brand-ink" aria-hidden="true" />
            <span className="text-[15px] font-bold leading-tight text-ink">Anotar un préstamo</span>
            <span className="text-[13px] leading-snug text-muted">“Te presté $5 para el taxi”</span>
          </Link>
          <Link to="/unirme" className="flex flex-col gap-2 rounded-3xl border border-line bg-surface px-4 py-4 shadow-card transition active:scale-[0.98]">
            <Hash size={24} className="text-brand-ink" aria-hidden="true" />
            <span className="text-[15px] font-bold leading-tight text-ink">Unirme con código</span>
            <span className="text-[13px] leading-snug text-muted">Si alguien te lo dicta en la mesa</span>
          </Link>
        </div>

        {/* En curso */}
        {loading && !data ? (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-[76px]" />
            <Skeleton className="h-[76px]" />
          </div>
        ) : bills.length > 0 ? (
          <>
            <SectionTitle>En curso</SectionTitle>
            <ul className="space-y-2.5">
              {bills.map((bill) => {
                const s = billStatus(bill)
                return (
                  <li key={bill.code}>
                    <Link to={`/c/${bill.code}`} className="flex items-center gap-3.5 rounded-3xl border border-line bg-surface px-4 py-3.5 shadow-card transition active:scale-[0.99]">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-[24px]" aria-hidden="true">
                        {titleEmoji(bill.title)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[16px] font-bold text-ink">{bill.title}</span>
                          <span className="shrink-0 text-[15px] font-bold text-ink tabular">{formatMoney(bill.total_cents, bill.currency)}</span>
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <StatusPill tone={s.tone}>{s.text}</StatusPill>
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <div className={cx('mt-6', b && (b.owedToMe > 0 || b.iOwe > 0) && 'hidden')}>
            <EmptyState emoji="🍽️" title="Tu primera cuenta toma 20 segundos" body="Escribe el total, comparte el link y cada uno ve cuánto le toca. Nadie tiene que descargar nada." />
          </div>
        )}
      </Page>
    </>
  )
}
