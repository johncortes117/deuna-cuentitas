// ─── Saldos ──────────────────────────────────────────────────
// Una fila por persona con el neto de todo lo que hay entre los dos
// (cuentas y préstamos). Lo que pide una acción tuya va primero.
import { Link, useNavigate } from 'react-router'
import { ChevronRight, HandCoins, History } from 'lucide-react'
import { useSession } from '../../state/session'
import { useNotifications } from '../../state/notifications'
import { useData } from '../../hooks/useData'
import { api } from '../../lib/api'
import { buildBalances, originsLabel } from '../../lib/ledger'
import type { PersonBalance } from '../../lib/ledger'
import { formatMoney } from '../../lib/money'
import { relativeDay } from '../../lib/dates'
import { distinctColors } from '../../lib/avatar'
import { errorMessage } from '../../lib/errors'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { StatusPill } from '../../ui/Controls'
import { Card, EmptyState, ErrorScreen, Page, SectionTitle, Skeleton } from '../../ui/Layout'
import { cx } from '../../ui/cx'
import { titleEmoji } from '../shared/titles'

function PersonRow({ p }: { p: PersonBalance }) {
  const owed = p.net > 0
  const status =
    p.toConfirm.length > 0 ? (
      <StatusPill tone="warn">Dice que te pagó</StatusPill>
    ) : p.awaiting.length > 0 ? (
      <StatusPill tone="muted">Esperando que confirme</StatusPill>
    ) : p.kind === 'link' ? (
      <StatusPill tone="muted">Link sin abrir</StatusPill>
    ) : p.kind === 'guest' ? (
      <StatusPill tone="muted">Sin app</StatusPill>
    ) : null
  const title = p.kind === 'link' ? originsLabel(p.debts) : p.name
  return (
    <Link to={`/saldos/${encodeURIComponent(p.key)}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-2 active:bg-surface-2">
      {p.kind === 'link' ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-line-strong bg-surface-2 text-[20px]" aria-hidden="true">
          {titleEmoji(p.debts[0]?.concept)}
        </span>
      ) : (
        <Avatar name={p.name} color={p.color} guest={p.kind === 'guest'} size={44} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold text-ink">{title}</span>
        <span className="mt-1 flex items-center gap-2">
          {status}
          <span className="truncate text-[13px] text-muted">
            {p.kind === 'link' ? relativeDay(p.lastAt) : `${originsLabel(p.debts)} · ${relativeDay(p.lastAt)}`}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {p.net !== 0 && <span className={cx('text-[16px] font-bold tabular', owed ? 'text-positive' : 'text-ink')}>{formatMoney(Math.abs(p.net), p.currency)}</span>}
        <ChevronRight size={18} className="text-subtle" aria-hidden="true" />
      </span>
    </Link>
  )
}

export default function BalancesPage() {
  const { profile } = useSession()
  const { signal } = useNotifications()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useData(async () => buildBalances(await api.ledger(), profile!.id), String(signal))

  if (error && !data) return <ErrorScreen title="No pudimos cargar tus saldos" body={errorMessage(error)} action={<Button full onClick={() => void reload()}>Reintentar</Button>} />

  // En la lista nadie repite color (como en una mesa).
  const people = data ? distinctColors(data.people) : []
  const toConfirm = people.filter((p) => p.toConfirm.length > 0)
  const owedToMe = people.filter((p) => p.toConfirm.length === 0 && p.net > 0)
  const iOwe = people.filter((p) => p.toConfirm.length === 0 && p.net < 0)
  const waiting = people.filter((p) => p.toConfirm.length === 0 && p.net === 0)

  return (
    <>
      <header className="px-5 pb-1 pt-safe">
        <h1 className="pt-4 text-[28px] font-extrabold tracking-[-0.035em] text-ink">Saldos</h1>
      </header>
      <Page withNav className="pt-3">
        {loading && !data ? (
          <>
            <Skeleton className="h-[92px] rounded-3xl" />
            <Skeleton className="mt-6 h-[220px] rounded-3xl" />
          </>
        ) : data && data.people.length === 0 ? (
          <EmptyState emoji="🎉" title="Estás al día" body="Nadie te debe y no le debes a nadie. Si le prestas algo a un amigo, anótalo para que no se olvide.">
            <Button full variant="secondary" icon={<HandCoins size={19} />} onClick={() => navigate('/prestamo')}>
              Anotar un préstamo
            </Button>
          </EmptyState>
        ) : (
          data && (
            <>
              <Card className="grid grid-cols-2 divide-x divide-line">
                <div className="px-5 py-4">
                  <p className="text-[13px] font-semibold text-muted">Te deben</p>
                  <p className={cx('mt-0.5 text-[26px] font-extrabold tracking-[-0.03em] tabular', data.owedToMe > 0 ? 'text-positive' : 'text-subtle')}>{formatMoney(data.owedToMe)}</p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[13px] font-semibold text-muted">Debes</p>
                  <p className={cx('mt-0.5 text-[26px] font-extrabold tracking-[-0.03em] tabular', data.iOwe > 0 ? 'text-ink' : 'text-subtle')}>{formatMoney(data.iOwe)}</p>
                </div>
              </Card>

              {toConfirm.length > 0 && (
                <>
                  <SectionTitle>Por confirmar</SectionTitle>
                  <Card className="overflow-hidden border-warning/30">
                    <ul className="divide-y divide-line">
                      {toConfirm.map((p) => (
                        <li key={p.key}>
                          <PersonRow p={p} />
                        </li>
                      ))}
                    </ul>
                  </Card>
                </>
              )}
              {owedToMe.length > 0 && (
                <>
                  <SectionTitle>Te deben</SectionTitle>
                  <Card className="overflow-hidden">
                    <ul className="divide-y divide-line">
                      {owedToMe.map((p) => (
                        <li key={p.key}>
                          <PersonRow p={p} />
                        </li>
                      ))}
                    </ul>
                  </Card>
                </>
              )}
              {iOwe.length > 0 && (
                <>
                  <SectionTitle>Debes</SectionTitle>
                  <Card className="overflow-hidden">
                    <ul className="divide-y divide-line">
                      {iOwe.map((p) => (
                        <li key={p.key}>
                          <PersonRow p={p} />
                        </li>
                      ))}
                    </ul>
                  </Card>
                </>
              )}
              {waiting.length > 0 && (
                <>
                  <SectionTitle>Esperando respuesta</SectionTitle>
                  <Card className="overflow-hidden">
                    <ul className="divide-y divide-line">
                      {waiting.map((p) => (
                        <li key={p.key}>
                          <PersonRow p={p} />
                        </li>
                      ))}
                    </ul>
                  </Card>
                </>
              )}
              <div className="mt-6 flex flex-col gap-1">
                <Button full variant="secondary" size="md" icon={<HandCoins size={18} />} onClick={() => navigate('/prestamo')}>
                  Anotar un préstamo
                </Button>
                <Button full variant="ghost" size="md" icon={<History size={18} />} onClick={() => navigate('/saldos/historial')}>
                  Ver historial
                </Button>
              </div>
            </>
          )
        )}
      </Page>
    </>
  )
}
