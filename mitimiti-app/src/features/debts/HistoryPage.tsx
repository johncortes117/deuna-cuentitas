import { useSession } from '../../state/session'
import { useData } from '../../hooks/useData'
import { api } from '../../lib/api'
import { buildBalances, debtOrigin } from '../../lib/ledger'
import { formatMoney } from '../../lib/money'
import { relativeDay } from '../../lib/dates'
import { firstName } from '../../lib/avatar'
import type { LedgerDebt } from '../../lib/types'
import { Card, EmptyState, Page, Skeleton, TopBar } from '../../ui/Layout'
import { cx } from '../../ui/cx'

function describe(d: LedgerDebt, me: string): { title: string; inflow: boolean; struck: boolean } {
  const iAmCreditor = d.creditor_id === me
  const other = firstName(iAmCreditor ? d.debtor_name : d.creditor_name) || 'Alguien'
  if (d.status === 'settled') return { title: iAmCreditor ? `${other} te pagó` : `Le pagaste a ${other}`, inflow: iAmCreditor, struck: false }
  if (d.status === 'forgiven') return { title: iAmCreditor ? `Perdonaste a ${other}` : `${other} te perdonó`, inflow: false, struck: true }
  // declined
  return { title: d.created_by === me ? `${other} dijo que no reconoce esto` : `No reconociste lo de ${other}`, inflow: false, struck: true }
}

export default function HistoryPage() {
  const { profile } = useSession()
  const { data, loading } = useData(async () => buildBalances(await api.ledger(), profile!.id, profile!.color).history, 'history')
  return (
    <>
      <TopBar back="/saldos" title="Historial" />
      <Page className="pt-2">
        {loading && !data ? (
          <Skeleton className="h-64 rounded-3xl" />
        ) : !data || data.length === 0 ? (
          <EmptyState emoji="🗂️" title="Todavía no hay movimientos" body="Aquí verás lo que ya se pagó, se perdonó o no se reconoció." />
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {data.map((d) => {
                const x = describe(d, profile!.id)
                return (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3.5">
                    <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px]', d.status === 'settled' ? 'bg-positive-soft' : 'bg-surface-2')} aria-hidden="true">
                      {d.status === 'settled' ? '✓' : d.status === 'forgiven' ? '🤍' : '🤔'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">{x.title}</span>
                      <span className="block truncate text-[13px] text-muted">
                        {debtOrigin(d)} · {relativeDay(d.settled_at ?? d.responded_at ?? d.created_at)}
                      </span>
                    </span>
                    <span className={cx('shrink-0 text-[15px] font-bold tabular', x.struck ? 'text-subtle line-through' : x.inflow ? 'text-positive' : 'text-ink')}>
                      {x.inflow ? '+' : ''}
                      {formatMoney(d.amount_cents, d.currency)}
                    </span>
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
