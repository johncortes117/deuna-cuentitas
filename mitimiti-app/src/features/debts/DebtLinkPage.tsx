// ─── El amigo abre el link de una deuda: /d/<token> ──────────
// Una pregunta y la respuesta más común en el botón grande:
//  • "Pedro te prestó $1,50" → "Sí, se lo debo" (y ahí mismo, cómo pagarle).
//  • "Pedro anotó que te debe $5" → "Sí, me debe".
//  • "De «Cena» te tocan $9,20" (estabas en la mesa sin la app) → "Es mío".
// Siempre hay una salida discreta para no quedar con una deuda que no es.
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useSession } from '../../state/session'
import { useData } from '../../hooks/useData'
import { api, track } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../lib/avatar'
import { relativeDay } from '../../lib/dates'
import { debtLink, debtLinkMessage } from '../../lib/share'
import type { DebtPreview } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { BottomBar, Card, ErrorScreen, Page, SectionTitle, TopBar } from '../../ui/Layout'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'
import { success } from '../../ui/haptics'
import { Splash } from '../../AppFrame'
import { ConfirmSheet } from '../shared/ConfirmSheet'
import { NameForm } from '../shared/NameForm'
import { PayOptions } from '../shared/PayOptions'
import { ReportPaymentSheet } from '../shared/ReportPaymentSheet'
import { ShareButtons } from '../shared/ShareButtons'
import { titleEmoji } from '../shared/titles'

type Mode = 'creator' | 'cancelled' | 'question' | 'mine' | 'used'

function modeOf(p: DebtPreview): Mode {
  if (p.viewer === 'creator') return 'creator'
  if (p.status === 'cancelled') return 'cancelled'
  if (p.viewer === 'counterparty') return 'mine'
  const answerable = p.kind === 'direct' ? p.status === 'pending' : p.status === 'open' || p.status === 'reported'
  return !p.claimed && answerable ? 'question' : 'used'
}

function Summary({ p, lead }: { p: DebtPreview; lead: string }) {
  const what = p.kind === 'bill' ? (p.bill?.title ?? 'la cuenta') : (p.concept ?? 'Préstamo')
  return (
    <div className="flex flex-col items-center px-4 text-center">
      <Avatar name={p.creator_name} color={p.creator_color} size={72} />
      <p className="mt-3 text-[16px] text-muted">{lead}</p>
      <p className="text-[46px] font-extrabold leading-tight tracking-[-0.045em] text-ink tabular">{formatMoney(p.amount_cents, p.currency)}</p>
      <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[14px] font-semibold text-ink-2">
        <span aria-hidden="true">{titleEmoji(p.kind === 'bill' ? p.bill?.title : p.concept)}</span>
        {what} · {relativeDay(p.created_at)}
      </p>
    </div>
  )
}

export default function DebtLinkPage() {
  const { token = '' } = useParams()
  const { ready, profile, start } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: p, loading, error, reload } = useData(() => api.debtPreview(token), `${token}:${profile?.id ?? 'anon'}`)
  const [sheet, setSheet] = useState<'decline' | 'pay' | null>(null)
  const [busy, setBusy] = useState(false)

  if (!ready || (loading && !p)) return <Splash />
  if (error && !p) return <ErrorScreen title="No pudimos abrir el link" body={errorMessage(error)} action={<Button full onClick={() => void reload()}>Reintentar</Button>} />
  if (!p) {
    return (
      <>
        <TopBar back="/" />
        <ErrorScreen title="No encontramos esta deuda" body="Revisa que el link esté completo, o pídele a tu amigo que te lo envíe otra vez." action={<Button full onClick={() => navigate('/')}>Ir a MitiMiti</Button>} />
      </>
    )
  }

  const mode = modeOf(p)
  const creator = firstName(p.creator_name)
  // Quien anotó es quien prestó → el que abre el link es quien debe.
  const iOwe = p.creator_is_creditor
  const lead = p.kind === 'bill' ? `De «${p.bill?.title ?? 'la cuenta'}» te tocan` : iOwe ? `${creator} te prestó` : `${creator} anotó que te debe`

  const respond = async (accept: boolean, name?: string) => {
    setBusy(true)
    try {
      if (name) await start(name)
      await api.respondDebt(token, accept)
      success()
      track(accept ? 'debt_link_accept_ui' : 'debt_link_decline_ui', { kind: p.kind, new_user: Boolean(name) })
      setSheet(null)
      if (p.kind === 'bill' && p.bill) {
        navigate(`/c/${p.bill.code}`, { replace: true })
        return
      }
      await reload()
    } catch (err) {
      toast({ title: errorMessage(err), tone: 'error', emoji: '⚠️' })
      await reload()
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'creator') {
    return (
      <div className="flex min-h-dvh flex-col">
        <TopBar back="/saldos" />
        <Page className="flex flex-col pt-4">
          <Summary p={p} lead={p.status === 'pending' ? 'Tu link, esperando que lo abran' : `${firstName(p.counterpart_name ?? 'Tu amigo')} ya lo respondió`} />
          <BottomBar>
            {p.status === 'pending' ? (
              <ShareButtons message={debtLinkMessage(p.creator_is_creditor, p.amount_cents, p.currency, p.concept, token)} link={debtLink(token)} />
            ) : (
              <Button full onClick={() => navigate('/saldos')}>Ver mis saldos</Button>
            )}
          </BottomBar>
        </Page>
      </div>
    )
  }

  if (mode === 'cancelled' || mode === 'used') {
    return (
      <>
        <TopBar back="/" />
        <ErrorScreen
          title={mode === 'cancelled' ? 'Este link ya no está disponible' : p.status === 'settled' ? 'Esta deuda ya está pagada' : 'Este link ya se usó'}
          body={
            mode === 'cancelled'
              ? `${creator} lo anuló, así que no hay nada que pagar aquí.`
              : `Si fuiste tú, ábrelo desde el celular donde lo aceptaste. Si no, pídele a ${creator} que te envíe uno nuevo.`
          }
          action={<Button full variant="secondary" onClick={() => navigate('/')}>Ir a MitiMiti</Button>}
        />
      </>
    )
  }

  if (mode === 'mine') {
    const settled = p.status === 'settled' || p.status === 'forgiven'
    return (
      <div className="flex min-h-dvh flex-col">
        <TopBar back="/saldos" />
        <Page className="flex flex-col pt-4">
          <Summary p={p} lead={lead} />
          {p.kind === 'bill' ? (
            <Card className="mt-6 px-5 py-4 text-center">
              <p className="text-[17px] font-bold text-ink">Ya es tuya: estás en «{p.bill?.title}»</p>
              <p className="mt-1 text-[14px] text-muted">Ahí ves cómo pagarle a {creator}.</p>
            </Card>
          ) : p.status === 'declined' ? (
            <Card className="mt-6 px-5 py-4 text-center">
              <p className="text-[17px] font-bold text-ink">Le avisamos a {creator}</p>
              <p className="mt-1 text-[14px] text-muted">Esto no quedó anotado a tu nombre.</p>
            </Card>
          ) : settled ? (
            <Card className="mt-6 px-5 py-4 text-center">
              <p className="text-[17px] font-bold text-ink">{p.status === 'forgiven' ? 'Esta deuda se perdonó' : '¡Listo! Ya está pagada'} ✓</p>
            </Card>
          ) : p.status === 'reported' ? (
            <div className="mt-6 rounded-2xl bg-warning-soft px-4 py-3 text-center text-[14px] font-semibold text-warning" role="status">
              Le avisaste a {creator} que pagaste. Falta que lo confirme.
            </div>
          ) : iOwe ? (
            <>
              <SectionTitle>Cómo pagarle a {creator}</SectionTitle>
              <Card className="px-4 py-1">
                <PayOptions name={p.creator_name} methods={p.pay_methods} onCopy={(type) => track('pay_data_copied', { type, from: 'link' })} />
              </Card>
            </>
          ) : (
            <Card className="mt-6 px-5 py-4 text-center">
              <p className="text-[17px] font-bold text-ink">
                Listo: {creator} te debe {formatMoney(p.amount_cents, p.currency)}
              </p>
              <p className="mt-1 text-[14px] text-muted">Lo ves en Saldos. Te avisaremos cuando te pague.</p>
            </Card>
          )}
          <BottomBar>
            {p.kind === 'bill' && p.bill ? (
              <Button full onClick={() => navigate(`/c/${p.bill!.code}`)}>Ver la cuenta</Button>
            ) : iOwe && p.status === 'open' ? (
              <div className="flex flex-col gap-2">
                <Button full onClick={() => setSheet('pay')}>Ya le pagué</Button>
                <Button full variant="ghost" size="md" onClick={() => navigate('/saldos')}>Le pago después</Button>
              </div>
            ) : (
              <Button full onClick={() => navigate('/saldos')}>Ver mis saldos</Button>
            )}
          </BottomBar>
        </Page>
        <ReportPaymentSheet
          open={sheet === 'pay'}
          onClose={() => setSheet(null)}
          to={p.creator_name}
          amountCents={p.amount_cents}
          currency={p.currency}
          methods={p.pay_methods}
          onConfirm={async (method) => {
            try {
              await api.reportPayment([p.id], method)
              success()
              toast({ title: `Le avisamos a ${creator}`, emoji: '📨', tone: 'good' })
              setSheet(null)
              await reload()
            } catch (err) {
              toast({ title: errorMessage(err), tone: 'error', emoji: '⚠️' })
            }
          }}
        />
      </div>
    )
  }

  // La pregunta.
  const yes = p.kind === 'bill' ? 'Sí, es mío' : iOwe ? 'Sí, se lo debo' : `Sí, me debe ${formatMoney(p.amount_cents, p.currency)}`
  const no = iOwe ? `No le debo nada a ${creator}` : `${creator} no me debe nada`

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar back="/" />
      <Page className="flex flex-col pt-4">
        <Summary p={p} lead={lead} />
        <p className="mx-auto mt-5 max-w-[320px] text-center text-[15px] leading-snug text-muted">
          {p.kind === 'bill'
            ? `Si estuviste en la mesa, quédate con tu parte: verás cómo pagarle a ${creator}.`
            : iOwe
              ? `Si es correcto, queda anotado y ves cómo pagarle a ${creator}, ahora o después.`
              : `Si es correcto, queda anotado y ${creator} podrá pagarte.`}
        </p>
        <BottomBar>
          {profile ? (
            <>
              <Button full loading={busy} onClick={() => respond(true)}>
                {yes}
              </Button>
              {p.kind === 'direct' && (
                <button type="button" onClick={() => setSheet('decline')} className="mx-auto mt-2 block px-4 py-2 text-[14px] font-semibold text-muted">
                  {no}
                </button>
              )}
            </>
          ) : (
            <NameForm
              cta={yes}
              hint={`Así te verá ${creator}. No necesitas descargar nada.`}
              onSubmit={(name) => respond(true, name)}
              footer={
                p.kind === 'direct' ? (
                  <button type="button" onClick={() => setSheet('decline')} className="mx-auto block px-4 py-1 text-[14px] font-semibold text-muted">
                    {no}
                  </button>
                ) : undefined
              }
            />
          )}
        </BottomBar>
      </Page>
      {profile ? (
        <ConfirmSheet
          open={sheet === 'decline'}
          onClose={() => setSheet(null)}
          title={iOwe ? `¿No le debes nada a ${creator}?` : `¿${creator} no te debe nada?`}
          body={`Le avisaremos a ${creator} y esto no quedará anotado a tu nombre.`}
          confirmLabel="Sí, avisarle"
          onConfirm={() => respond(false)}
        />
      ) : (
        <Sheet
          open={sheet === 'decline'}
          onClose={() => setSheet(null)}
          title={iOwe ? `¿No le debes nada a ${creator}?` : `¿${creator} no te debe nada?`}
          description={`Dinos tu nombre y le avisamos a ${creator}. No quedará anotado a tu nombre.`}
        >
          <div className="pb-3 pt-2">
            <NameForm cta={`Avisarle a ${creator}`} hint="Solo para que sepa quién respondió." onSubmit={(name) => respond(false, name)} />
          </div>
        </Sheet>
      )}
    </div>
  )
}
