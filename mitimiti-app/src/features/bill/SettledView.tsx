// ─── ¡Todo cuadrado! ─────────────────────────────────────────
// El cierre que da gusto compartir: todos pagaron, y cuánto tardaron.
import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { BillBundle } from '../../lib/types'
import { formatMoney } from '../../lib/money'
import { formatDuration } from '../../lib/dates'
import { track } from '../../lib/api'
import { Button } from '../../ui/Button'
import { Card, Page, SectionTitle, TopBar } from '../../ui/Layout'
import { Confetti } from '../../ui/Confetti'
import { groupPrize } from '../../lib/groupPrize'
import { useShowReceipt } from '../../state/receipts'
import { Share2 } from 'lucide-react'
import { titleEmoji } from '../shared/titles'
import { MemberRow } from './parts'
import { grandTotal } from './splitFor'

function firstTimeSeen(code: string): boolean {
  try {
    const key = `mitimiti-celebrated-${code}`
    if (sessionStorage.getItem(key)) return false
    sessionStorage.setItem(key, '1')
    return true
  } catch {
    return false
  }
}

export function SettledView({ bundle }: { bundle: BillBundle }) {
  const navigate = useNavigate()
  const [celebrate] = useState(() => firstTimeSeen(bundle.bill.code))
  const { bill, members } = bundle
  const seconds = bill.settled_at ? (Date.parse(bill.settled_at) - Date.parse(bill.created_at)) / 1000 : null
  const forgiven = bundle.debts.filter((d) => d.status === 'forgiven').length
  const showReceipt = useShowReceipt()

  // El recibo grupal, con un solo micro-premio (el primero que aplique).
  const openGroupReceipt = () => {
    const settledAt = bill.settled_at ?? new Date().toISOString()
    const lockedAt = bill.locked_at ?? bill.created_at
    const first = bundle.debts
      .filter((d) => d.status === 'settled' && d.settled_at)
      .sort((a, b) => Date.parse(a.settled_at!) - Date.parse(b.settled_at!))[0]
    const prize = groupPrize({
      loans: [], // La app propia no tiene préstamos dentro de una cuenta.
      firstPayment: first ? { name: first.debtor_name.split(' ')[0], seconds: (Date.parse(first.settled_at!) - Date.parse(lockedAt)) / 1000 } : null,
      splitMode: bill.split_mode,
      totalSeconds: (Date.parse(settledAt) - Date.parse(bill.created_at)) / 1000,
    })
    showReceipt({
      kind: 'group',
      data: {
        planName: bill.title,
        hostName: members.find((m) => m.is_host)?.name ?? '',
        participants: members.map((m) => m.name),
        totalCents: grandTotal(bundle),
        currency: bill.currency,
        createdAt: bill.created_at,
        settledAt,
        prize,
      },
    })
    track('settled_shared', { prize: prize?.label ?? null })
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {celebrate && <Confetti />}
      <TopBar back="/" title={bill.title} />
      <Page className="flex flex-col pt-2">
        <div className="flex flex-col items-center px-4 pb-2 pt-4 text-center">
          <span className="flex h-20 w-20 animate-pop items-center justify-center rounded-full bg-positive-soft text-[38px]" aria-hidden="true">
            {titleEmoji(bill.title)}
          </span>
          <h1 className="mt-4 text-[30px] font-extrabold tracking-[-0.035em] text-ink">¡Todo cuadrado!</h1>
          <p className="mt-1.5 text-[16px] text-muted text-balance">
            {forgiven > 0 ? 'Todo quedó saldado' : 'Todos pagaron su parte'} de «{bill.title}»
            {seconds !== null && seconds > 0 && seconds < 7 * 86400 && <> en {formatDuration(seconds)}</>}.
          </p>
        </div>

        <SectionTitle>Resumen · {formatMoney(grandTotal(bundle), bill.currency)}</SectionTitle>
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.id}>
                <MemberRow member={m} bundle={bundle} amount={m.share_cents ?? 0} />
              </li>
            ))}
          </ul>
        </Card>

        <div className="mt-auto flex flex-col gap-2.5 pt-8">
          <Button full icon={<Share2 size={19} />} onClick={openGroupReceipt}>
            Contarle al grupo
          </Button>
          <Button full variant="secondary" onClick={() => navigate('/')}>
            Volver al inicio
          </Button>
        </div>
      </Page>
    </div>
  )
}

export function CancelledView({ bundle }: { bundle: BillBundle }) {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar back="/" title={bundle.bill.title} />
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-[30px]" aria-hidden="true">🗑️</span>
        <h1 className="text-[22px] font-bold text-ink">Esta cuenta se canceló</h1>
        <p className="mt-2 text-[15px] text-muted">Nadie quedó debiendo nada por «{bundle.bill.title}».</p>
        <Button className="mt-6" onClick={() => navigate('/')}>
          Ir al inicio
        </Button>
      </div>
    </div>
  )
}
