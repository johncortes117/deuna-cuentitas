// ─── Cuenta dividida: ahora a pagar ──────────────────────────
// Quien pagó en el local ve quién le debe, confirma los avisos de pago y
// recuerda al resto. Quien debe ve exactamente cuánto, los datos para pagar
// (con copiar) y avisa "Ya le pagué" en un toque.
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { MoreHorizontal, Pencil, Send, Trash2 } from 'lucide-react'
import type { BillBundle, BillDebt, PayMethodType, PendingSettlement } from '../../lib/types'
import { api, track } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../lib/avatar'
import { timeAgo } from '../../lib/dates'
import { METHOD_LABEL, PAID_VIA, PAID_WITH } from '../../lib/payMethods'
import { billReminderMessage, guestShareMessage, openWhatsApp } from '../../lib/share'
import { useSession } from '../../state/session'
import { Button, IconButton } from '../../ui/Button'
import { Chip, StatusPill } from '../../ui/Controls'
import { BottomBar, Card, Page, SectionTitle, TopBar } from '../../ui/Layout'
import { Avatar } from '../../ui/Avatar'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'
import { success } from '../../ui/haptics'
import { ConfirmSheet } from '../shared/ConfirmSheet'
import { PayOptions } from '../shared/PayOptions'
import { ReportPaymentSheet } from '../shared/ReportPaymentSheet'
import { BillSummary, DebtStatusPill } from './parts'
import type { BillViewProps } from './OpenViews'

function useRunner(refresh: () => Promise<void>) {
  const toast = useToast()
  return async (fn: () => Promise<unknown>, ok?: { title: string; emoji?: string }) => {
    try {
      await fn()
      if (ok) {
        success()
        toast({ title: ok.title, emoji: ok.emoji ?? '✅', tone: 'good' })
      }
    } catch (err) {
      toast({ title: errorMessage(err), tone: 'error', emoji: '⚠️' })
    } finally {
      await refresh()
    }
  }
}

export function LockedView(props: BillViewProps) {
  const { bundle } = props
  const iAmPayer = bundle.payer?.member_id === bundle.me.member_id
  return iAmPayer ? <PayerView {...props} /> : <DebtorView {...props} />
}

function Header({ bundle, live, menu }: { bundle: BillBundle; live: boolean; menu?: ReactNode }) {
  return (
    <>
      <TopBar back="/" title={bundle.bill.title} right={menu} />
      <BillSummary bundle={bundle} live={live} />
    </>
  )
}

// ─── Quien pagó la cuenta ─────────────────────────────────────

function PayerView({ bundle, live, refresh }: BillViewProps) {
  const { profile } = useSession()
  const navigate = useNavigate()
  const run = useRunner(refresh)
  const [menu, setMenu] = useState(false)
  const [confirm, setConfirm] = useState<'unlock' | 'cancel' | null>(null)
  const [receiving, setReceiving] = useState<BillDebt | null>(null)
  const currency = bundle.bill.currency
  const debts = bundle.debts
  const pending = debts.filter((d) => d.status === 'open' || d.status === 'reported')
  const done = debts.filter((d) => d.status === 'settled' || d.status === 'forgiven')
  const pendingCents = pending.reduce((a, d) => a + d.amount_cents, 0)
  const anyPaid = debts.some((d) => d.status !== 'open')
  const memberById = new Map(bundle.members.map((m) => [m.id, m]))
  const settlementFor = (d: BillDebt): PendingSettlement | undefined => bundle.settlements.find((s) => s.id === d.settlement_id)
  const noMethods = (profile?.pay_methods.length ?? 0) === 0

  const remind = (d: BillDebt) => {
    const sent = openWhatsApp(
      d.debtor_id
        ? billReminderMessage(d.debtor_name, d.amount_cents, currency, bundle.bill.title, bundle.bill.code)
        : guestShareMessage(d.debtor_name, d.amount_cents, currency, bundle.bill.title, d.link_token ?? ''),
    )
    if (d.debtor_id) void api.remind(d.debtor_id).catch(() => undefined)
    track('bill_reminder_sent', { guest: !d.debtor_id, whatsapp: sent })
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Page className="flex flex-col">
        <Header
          bundle={bundle}
          live={live}
          menu={
            bundle.me.is_host && !anyPaid ? (
              <IconButton label="Opciones" onClick={() => setMenu(true)}>
                <MoreHorizontal size={24} />
              </IconButton>
            ) : undefined
          }
        />

        <Card className="mt-3 px-5 py-4">
          {pending.length > 0 ? (
            <>
              <p className="text-[14px] font-semibold text-muted">Te deben</p>
              <p className="mt-0.5 text-[34px] font-extrabold tracking-[-0.04em] text-positive tabular">{formatMoney(pendingCents, currency)}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                <div className="h-full rounded-full bg-positive-fill transition-all" style={{ width: `${(done.length / Math.max(1, debts.length)) * 100}%` }} />
              </div>
              <p className="mt-2 text-[14px] text-muted">
                {done.length} de {debts.length} ya te {done.length === 1 ? 'pagó' : 'pagaron'}
              </p>
            </>
          ) : (
            <p className="text-[16px] font-bold text-ink">Nadie te debe nada en esta cuenta.</p>
          )}
        </Card>

        {noMethods && pending.length > 0 && (
          <button type="button" onClick={() => navigate(`/tu/cobros?next=${encodeURIComponent(`/c/${bundle.bill.code}`)}`)} className="mt-3 flex w-full items-center gap-3 rounded-3xl border border-brand/30 bg-brand-soft px-4 py-3.5 text-left">
            <span className="text-[22px]" aria-hidden="true">💳</span>
            <span className="flex-1">
              <span className="block text-[15px] font-bold text-ink">Agrega cómo te pagan</span>
              <span className="block text-[13.5px] leading-snug text-ink-2">Tu cuenta del banco, Deuna o Payphone: así te pagan en un minuto, sin preguntarte.</span>
            </span>
          </button>
        )}

        <SectionTitle>Quién te debe</SectionTitle>
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {debts.map((d) => {
              const m = d.member_id ? memberById.get(d.member_id) : undefined
              const s = settlementFor(d)
              return (
                <li key={d.id} className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={d.debtor_name} color={m?.color} guest={!d.debtor_id} size={42} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-semibold text-ink">{d.debtor_name}</p>
                      <div className="mt-1">
                        {d.status === 'reported' && s ? (
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <StatusPill tone="warn">Dice que te pagó</StatusPill>
                            <span className="text-[13px] text-muted">
                              {s.method ? `${METHOD_LABEL[s.method]} · ` : ''}
                              {timeAgo(s.created_at).toLowerCase()}
                            </span>
                          </span>
                        ) : (
                          <DebtStatusPill status={d.status} />
                        )}
                      </div>
                    </div>
                    <p className="shrink-0 text-[16px] font-bold text-ink tabular">{formatMoney(d.amount_cents, currency)}</p>
                  </div>
                  {d.status === 'reported' && s && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button size="md" variant="secondary" onClick={() => run(() => api.rejectSettlement(s.id), { title: `Le avisamos a ${firstName(d.debtor_name)} que no te llegó`, emoji: '📨' })}>
                        No me llegó
                      </Button>
                      <Button size="md" onClick={() => run(() => api.confirmSettlement(s.id), { title: `¡${firstName(d.debtor_name)} te pagó!`, emoji: '💰' })}>
                        Recibido
                      </Button>
                    </div>
                  )}
                  {d.status === 'open' && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button size="md" variant="secondary" onClick={() => setReceiving(d)}>
                        Ya me pagó
                      </Button>
                      <Button size="md" variant="soft" icon={<Send size={16} />} onClick={() => remind(d)}>
                        {d.debtor_id ? 'Recordar' : 'Enviar link'}
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
        <p className="mt-3 px-1 text-[13px] leading-snug text-muted">
          Cuando alguien te avise que pagó, revisa tu cuenta y toca <b>Recibido</b>. Si te pagan en efectivo, usa <b>Ya me pagó</b>.
        </p>
      </Page>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Opciones de la cuenta">
        <div className="pb-2 pt-1">
          <button type="button" onClick={() => { setMenu(false); setConfirm('unlock') }} className="flex w-full items-center gap-3.5 rounded-2xl px-2 py-3 text-left hover:bg-surface-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2" aria-hidden="true"><Pencil size={19} /></span>
            <span><span className="block text-[16px] font-semibold text-ink">Corregir la división</span><span className="block text-[13.5px] text-muted">Vuelve a quedar abierta para cambiar montos</span></span>
          </button>
          <button type="button" onClick={() => { setMenu(false); setConfirm('cancel') }} className="flex w-full items-center gap-3.5 rounded-2xl px-2 py-3 text-left hover:bg-surface-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger" aria-hidden="true"><Trash2 size={19} /></span>
            <span><span className="block text-[16px] font-semibold text-danger">Cancelar la cuenta</span><span className="block text-[13.5px] text-muted">Nadie quedará debiendo por ella</span></span>
          </button>
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirm === 'unlock'}
        onClose={() => setConfirm(null)}
        title="¿Corregir la división?"
        body="La cuenta vuelve a quedar abierta: puedes cambiar montos o sumar a alguien, y todos ven los cambios."
        confirmLabel="Sí, corregir"
        onConfirm={() => run(() => api.unlockBill(bundle.bill.id)).then(() => setConfirm(null))}
      />
      <ConfirmSheet
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        title="¿Cancelar la cuenta?"
        body="Se cierra para todos y nadie queda debiendo nada por ella."
        confirmLabel="Sí, cancelar"
        danger
        onConfirm={() => run(() => api.cancelBill(bundle.bill.id)).then(() => navigate('/', { replace: true }))}
      />
      <ReceivedSheet
        debt={receiving}
        currency={currency}
        onClose={() => setReceiving(null)}
        onConfirm={(method) => run(() => api.markReceived([receiving!.id], method), { title: 'Anotado: ya te pagó', emoji: '💰' }).then(() => setReceiving(null))}
      />
    </div>
  )
}

function ReceivedSheet({ debt, currency, onClose, onConfirm }: { debt: BillDebt | null; currency: string; onClose: () => void; onConfirm: (m: PayMethodType) => Promise<void> }) {
  const [method, setMethod] = useState<PayMethodType>('cash')
  const [busy, setBusy] = useState(false)
  if (!debt) return null
  return (
    <Sheet
      open
      onClose={onClose}
      dismissible={!busy}
      title={`¿${firstName(debt.debtor_name)} ya te pagó ${formatMoney(debt.amount_cents, currency)}?`}
      description="Lo marcamos como pagado y le avisamos."
      footer={
        <Button
          full
          loading={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onConfirm(method)
            } finally {
              setBusy(false)
            }
          }}
        >
          Sí, ya me pagó
        </Button>
      }
    >
      <p className="mb-2.5 mt-2 text-[14px] font-semibold text-ink-2">¿Cómo te pagó?</p>
      <div className="flex flex-wrap gap-2 pb-2">
        {PAID_WITH.map((o) => (
          <Chip key={o.value} selected={method === o.value} onClick={() => setMethod(o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </Sheet>
  )
}

// ─── Quien debe su parte ──────────────────────────────────────

function DebtorView({ bundle, live, refresh }: BillViewProps) {
  const run = useRunner(refresh)
  const [paying, setPaying] = useState(false)
  const currency = bundle.bill.currency
  const payer = bundle.payer
  const mine = bundle.debts.find((d) => d.member_id === bundle.me.member_id)
  const mySettlement = mine ? bundle.settlements.find((s) => s.id === mine.settlement_id) : undefined
  const myItems = useMemo(() => {
    if (bundle.bill.split_mode !== 'items') return []
    const myClaims = new Set(bundle.claims.filter((c) => c.member_id === bundle.me.member_id).map((c) => c.item_id))
    return bundle.items.filter((i) => myClaims.has(i.id))
  }, [bundle])
  const others = bundle.debts.filter((d) => d.member_id !== bundle.me.member_id)
  const paidCount = bundle.debts.filter((d) => d.status === 'settled' || d.status === 'forgiven').length
  const payerName = payer?.name ?? 'quien pagó'

  return (
    <div className="flex min-h-dvh flex-col">
      <Page className="flex flex-col">
        <Header bundle={bundle} live={live} />

        {!mine ? (
          <Card className="mt-3 px-5 py-5 text-center">
            <p className="text-[30px]" aria-hidden="true">🎁</p>
            <p className="mt-1 text-[18px] font-bold text-ink">No te toca pagar nada</p>
            <p className="mt-1 text-[14px] text-muted">{firstName(payerName)} dividió la cuenta y tu parte quedó en $0.</p>
          </Card>
        ) : mine.status === 'settled' || mine.status === 'forgiven' ? (
          <Card className="mt-3 px-5 py-5 text-center">
            <p className="animate-pop text-[34px]" aria-hidden="true">✅</p>
            <p className="mt-1 text-[19px] font-bold text-ink">{mine.status === 'forgiven' ? `${firstName(payerName)} te perdonó tu parte` : `¡Listo! ${firstName(payerName)} confirmó tu pago`}</p>
            <p className="mt-1 text-[14px] text-muted">No le debes nada por «{bundle.bill.title}».</p>
          </Card>
        ) : (
          <>
            <Card className="mt-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <Avatar name={payerName} color={payer?.color} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-muted">Le debes a {firstName(payerName)}</p>
                  <p className="text-[34px] font-extrabold leading-tight tracking-[-0.04em] text-ink tabular">{formatMoney(mine.amount_cents, currency)}</p>
                </div>
              </div>
              {myItems.length > 0 && (
                <p className="mt-2 text-[13.5px] leading-snug text-muted">
                  Por {myItems.map((i) => i.name).join(', ')}, con tu parte de IVA y servicio.
                </p>
              )}
              {mine.status === 'reported' && (
                <div className="mt-3 rounded-2xl bg-warning-soft px-4 py-3 text-[14px] font-semibold text-warning" role="status">
                  Le avisaste que pagaste{mySettlement?.method ? ` ${PAID_VIA[mySettlement.method]}` : ''}. Falta que {firstName(payerName)} lo confirme.
                </div>
              )}
            </Card>

            {mine.status === 'open' && (
              <>
                <SectionTitle>Cómo pagarle</SectionTitle>
                <Card className="px-4 py-1">
                  <PayOptions name={payerName} methods={payer?.pay_methods ?? []} onCopy={(type) => track('pay_data_copied', { type })} />
                </Card>
              </>
            )}
          </>
        )}

        {others.length > 0 && (
          <>
            <SectionTitle>Así va la cuenta · {paidCount} de {bundle.debts.length} pagaron</SectionTitle>
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line">
                {others.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={d.debtor_name} color={bundle.members.find((m) => m.id === d.member_id)?.color} guest={!d.debtor_id} size={36} />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{d.debtor_name}</span>
                    <DebtStatusPill status={d.status} />
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        {mine && mine.status === 'open' && (
          <BottomBar>
            <Button full onClick={() => setPaying(true)}>
              Ya le pagué
            </Button>
          </BottomBar>
        )}
      </Page>

      {mine && (
        <ReportPaymentSheet
          open={paying}
          onClose={() => setPaying(false)}
          to={payerName}
          amountCents={mine.amount_cents}
          currency={currency}
          methods={payer?.pay_methods ?? []}
          onConfirm={(method) =>
            run(() => api.reportPayment([mine.id], method), { title: `Le avisamos a ${firstName(payerName)}`, emoji: '📨' }).then(() => {
              track('bill_payment_reported', { method })
              setPaying(false)
            })
          }
        />
      )}
    </div>
  )
}
