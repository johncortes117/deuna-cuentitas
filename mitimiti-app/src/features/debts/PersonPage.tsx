// ─── Todo lo que hay con una persona ─────────────────────────
// El neto arriba y una sola acción principal según quién debe a quién:
//  • Le debes: sus datos para pagar (con copiar) y "Ya le pagué".
//  • Te debe: recordarle por WhatsApp; "Ya me pagó" si fue en efectivo.
//  • Dice que te pagó: "Recibido" o "No me llegó".
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Send } from 'lucide-react'
import { useSession } from '../../state/session'
import { useNotifications } from '../../state/notifications'
import { useData } from '../../hooks/useData'
import { api, track } from '../../lib/api'
import { buildBalances, debtOrigin, originsLabel } from '../../lib/ledger'
import { errorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../lib/avatar'
import { relativeDay, timeAgo } from '../../lib/dates'
import { PAID_VIA, PAID_WITH, capitalize } from '../../lib/payMethods'
import { copyText, debtLink, debtLinkMessage, guestShareMessage, openWhatsApp, personReminderMessage } from '../../lib/share'
import type { PayMethodType } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { Chip, StatusPill } from '../../ui/Controls'
import { BottomBar, Card, ErrorScreen, Page, SectionTitle, Skeleton, TopBar } from '../../ui/Layout'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'
import { success } from '../../ui/haptics'
import { ConfirmSheet } from '../shared/ConfirmSheet'
import { PayOptions } from '../shared/PayOptions'
import { ReportPaymentSheet } from '../shared/ReportPaymentSheet'
import { titleEmoji } from '../shared/titles'

export default function PersonPage() {
  const { key = '' } = useParams()
  const { profile } = useSession()
  const { signal, refresh: refreshCounts } = useNotifications()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, loading, error, reload } = useData(async () => buildBalances(await api.ledger(), profile!.id, profile!.color), `${key}:${signal}`)
  const [sheet, setSheet] = useState<'pay' | 'received' | 'forgive' | 'cancel' | null>(null)
  const [method, setMethod] = useState<PayMethodType>('cash')

  const p = data?.people.find((x) => x.key === decodeURIComponent(key))

  const run = async (fn: () => Promise<unknown>, ok: { title: string; emoji: string }, back = false) => {
    try {
      await fn()
      success()
      toast({ title: ok.title, emoji: ok.emoji, tone: 'good' })
      setSheet(null)
      refreshCounts()
      if (back) navigate('/saldos', { replace: true })
      else await reload()
    } catch (err) {
      toast({ title: errorMessage(err), tone: 'error', emoji: '⚠️' })
      await reload()
    }
  }

  if (loading && !data) {
    return (
      <div className="px-5">
        <TopBar back="/saldos" />
        <Skeleton className="mx-auto mt-6 h-24 w-24 rounded-full" />
        <Skeleton className="mt-6 h-40 rounded-3xl" />
      </div>
    )
  }
  if (error && !data) return <ErrorScreen title="No pudimos cargar esto" body={errorMessage(error)} action={<Button full onClick={() => void reload()}>Reintentar</Button>} />
  if (!p) {
    return (
      <>
        <TopBar back="/saldos" />
        <ErrorScreen title="Ya no hay nada pendiente aquí" body="Puede que ya se haya pagado o cerrado." action={<Button full onClick={() => navigate('/saldos', { replace: true })}>Ver mis saldos</Button>} />
      </>
    )
  }

  const currency = p.currency
  const owesMe = p.net > 0
  const iOwe = p.net < 0
  const abs = Math.abs(p.net)
  const myCredits = p.debts.filter((d) => d.status === 'open' && d.creditor_id === profile!.id).map((d) => d.id)
  const what = originsLabel(p.debts)
  const name = p.kind === 'link' ? what : p.name

  const remind = () => {
    openWhatsApp(personReminderMessage(p.name, abs, currency, what))
    if (p.userId) void api.remind(p.userId).catch(() => undefined)
    track('person_reminder_sent', {})
    toast({ title: `Le recordamos a ${firstName(p.name)}`, emoji: '👋', tone: 'good' })
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar back="/saldos" title={name} />
      <Page className="flex flex-col pt-2">
        <div className="flex flex-col items-center text-center">
          {p.kind === 'link' ? (
            <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-line-strong bg-surface-2 text-[34px]" aria-hidden="true">
              {titleEmoji(p.debts[0]?.concept)}
            </span>
          ) : (
            <Avatar name={p.name} color={p.color} guest={p.kind === 'guest'} size={80} />
          )}
          <p className="mt-3 text-[15px] font-semibold text-muted">
            {p.kind === 'link' ? 'Link que nadie abrió todavía' : owesMe ? `${firstName(p.name)} te debe` : iOwe ? `Le debes a ${firstName(p.name)}` : 'Están a mano'}
          </p>
          {p.net !== 0 && <p className={`text-[44px] font-extrabold leading-tight tracking-[-0.045em] tabular ${owesMe ? 'text-positive' : 'text-ink'}`}>{formatMoney(abs, currency)}</p>}
        </div>

        {p.toConfirm.map((s) => (
          <Card key={s.id} className="mt-5 border-warning/30 px-5 py-4">
            <p className="text-[16px] font-bold text-ink">
              {firstName(p.name)} dice que te pagó {formatMoney(s.amount_cents, s.currency)}
            </p>
            <p className="mt-0.5 text-[14px] text-muted">
              {s.method ? `${capitalize(PAID_VIA[s.method])} · ${timeAgo(s.created_at).toLowerCase()}` : timeAgo(s.created_at)}. Revisa tu cuenta y confírmalo.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="md" variant="secondary" onClick={() => run(() => api.rejectSettlement(s.id), { title: `Le avisamos a ${firstName(p.name)} que no te llegó`, emoji: '📨' })}>
                No me llegó
              </Button>
              <Button size="md" onClick={() => run(() => api.confirmSettlement(s.id), { title: `¡${firstName(p.name)} te pagó!`, emoji: '💰' })}>
                Recibido
              </Button>
            </div>
          </Card>
        ))}

        {p.awaiting.map((s) => (
          <div key={s.id} className="mt-5 rounded-2xl bg-warning-soft px-4 py-3 text-[14px] font-semibold text-warning" role="status">
            Le avisaste que pagaste {formatMoney(s.amount_cents, s.currency)}{s.method ? ` ${PAID_VIA[s.method]}` : ''}. Falta que lo confirme.
          </div>
        ))}

        {iOwe && p.openIds.length > 0 && (
          <>
            <SectionTitle>Cómo pagarle</SectionTitle>
            <Card className="px-4 py-1">
              <PayOptions name={p.name} methods={p.payMethods} onCopy={(type) => track('pay_data_copied', { type, from: 'person' })} />
            </Card>
          </>
        )}

        <SectionTitle>Detalle</SectionTitle>
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {p.debts.map((d) => {
              const theyOwe = d.creditor_id === profile!.id
              return (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[18px]" aria-hidden="true">
                    {titleEmoji(d.kind === 'bill' ? d.bill_title : d.concept)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{debtOrigin(d)}</span>
                    <span className="block text-[13px] text-muted">
                      {theyOwe ? 'Te debe' : 'Le debes'} · {relativeDay(d.created_at)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`text-[15px] font-bold tabular ${theyOwe ? 'text-positive' : 'text-ink'}`}>
                      {theyOwe ? '+' : '−'}
                      {formatMoney(d.amount_cents, d.currency)}
                    </span>
                    {d.status === 'reported' && <StatusPill tone="warn">Por confirmar</StatusPill>}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>

        {p.kind === 'link' && (
          <p className="mt-3 px-1 text-[13.5px] leading-snug text-muted">Cuando tu amigo abra el link y lo acepte, aparecerá aquí con su nombre.</p>
        )}

        <BottomBar>
          {p.kind === 'link' ? (
            <div className="flex flex-col gap-2">
              <Button
                full
                icon={<Send size={18} />}
                onClick={() => {
                  const d = p.debts[0]
                  openWhatsApp(debtLinkMessage(d.creditor_id === profile!.id, d.amount_cents, d.currency, d.concept, d.link_token ?? ''))
                }}
              >
                Enviar el link otra vez
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={async () => {
                    if (await copyText(debtLink(p.debts[0].link_token ?? ''))) toast({ title: 'Link copiado', emoji: '🔗' })
                  }}
                >
                  Copiar link
                </Button>
                <Button variant="danger" size="md" onClick={() => setSheet('cancel')}>
                  Anular
                </Button>
              </div>
            </div>
          ) : owesMe ? (
            <div className="flex flex-col gap-2">
              {p.kind === 'guest' ? (
                <Button
                  full
                  icon={<Send size={18} />}
                  onClick={() => {
                    const d = p.debts[0]
                    openWhatsApp(guestShareMessage(p.name, abs, currency, d.bill_title ?? 'la cuenta', p.linkToken ?? ''))
                  }}
                >
                  Enviarle su parte
                </Button>
              ) : (
                <Button full icon={<Send size={18} />} onClick={remind}>
                  Recordar por WhatsApp
                </Button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="md" onClick={() => setSheet('received')}>
                  Ya me pagó
                </Button>
                <Button variant="ghost" size="md" onClick={() => setSheet('forgive')} disabled={myCredits.length === 0}>
                  Perdonar
                </Button>
              </div>
            </div>
          ) : iOwe && p.openIds.length > 0 ? (
            <Button full onClick={() => setSheet('pay')}>
              Ya le pagué {formatMoney(abs, currency)}
            </Button>
          ) : p.openIds.length > 0 ? (
            <Button full variant="secondary" onClick={() => run(() => api.markReceived(p.openIds, 'other'), { title: 'Listo: quedaron a mano', emoji: '🤝' }, true)}>
              Marcar que estamos a mano
            </Button>
          ) : null}
        </BottomBar>
      </Page>

      <ReportPaymentSheet
        open={sheet === 'pay'}
        onClose={() => setSheet(null)}
        to={p.name}
        amountCents={abs}
        currency={currency}
        methods={p.payMethods}
        onConfirm={(m) => run(() => api.reportPayment(p.openIds, m), { title: `Le avisamos a ${firstName(p.name)}`, emoji: '📨' })}
      />
      <Sheet
        open={sheet === 'received'}
        onClose={() => setSheet(null)}
        title={`¿${firstName(p.name)} ya te pagó ${formatMoney(abs, currency)}?`}
        description="Lo marcamos como pagado y le avisamos. No mueve dinero."
        footer={<Button full onClick={() => run(() => api.markReceived(p.openIds, method), { title: `Anotado: ${firstName(p.name)} ya te pagó`, emoji: '💰' }, true)}>Sí, ya me pagó</Button>}
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
      <ConfirmSheet
        open={sheet === 'forgive'}
        onClose={() => setSheet(null)}
        title={`¿Perdonarle la deuda a ${firstName(p.name)}?`}
        body={`Ya no te deberá eso. No se puede deshacer.`}
        confirmLabel="Sí, perdonar"
        danger
        onConfirm={() => run(() => api.forgive(myCredits), { title: `Perdonaste a ${firstName(p.name)}`, emoji: '🤍' }, true)}
      />
      <ConfirmSheet
        open={sheet === 'cancel'}
        onClose={() => setSheet(null)}
        title="¿Anular este link?"
        body="Se borra de tus saldos y ya nadie podrá usarlo."
        confirmLabel="Sí, anular"
        danger
        onConfirm={() => run(() => api.cancelDebt(p.debts[0].id), { title: 'Link anulado', emoji: '🗑️' }, true)}
      />
    </div>
  )
}
