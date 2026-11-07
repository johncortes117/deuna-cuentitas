// ─── Anotar un préstamo ──────────────────────────────────────
// "Le presté $1,50 para el taxi" o "me prestaron $5": una pantalla, el monto
// con el teclado propio, para qué fue (opcional) y un toque que anota y abre
// WhatsApp con el link. No se escribe el nombre del amigo: queda anotado con
// su propio perfil al abrir el link.
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, Pencil } from 'lucide-react'
import { api, track } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { formatMoney, inputToCents, keypadInput } from '../../lib/money'
import { debtLink, debtLinkMessage, openWhatsApp } from '../../lib/share'
import { TopBar } from '../../ui/Layout'
import { AmountInput, Keypad } from '../../ui/Keypad'
import { Button } from '../../ui/Button'
import { Chip, Segmented, TextField } from '../../ui/Controls'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'
import { success } from '../../ui/haptics'
import { ShareButtons, WhatsAppIcon } from '../shared/ShareButtons'
import { LOAN_CONCEPTS, titleEmoji } from '../shared/titles'

type Direction = 'lent' | 'borrowed'

export default function NewLoanPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [direction, setDirection] = useState<Direction>('lent')
  const [amount, setAmount] = useState('0')
  const [concept, setConcept] = useState<string | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{ token: string; sent: boolean } | null>(null)
  const cents = inputToCents(amount)
  const lent = direction === 'lent'
  const isSuggested = LOAN_CONCEPTS.some((c) => c.label === concept)

  const create = async () => {
    if (cents <= 0 || busy) return
    setBusy(true)
    try {
      const debt = await api.createDebt(direction, cents, concept)
      // Mismo toque: WhatsApp con el mensaje. Si el navegador lo bloquea, la
      // pantalla siguiente lo pide con un botón.
      const sent = openWhatsApp(debtLinkMessage(lent, cents, 'USD', concept, debt.link_token))
      success()
      track('loan_created', { direction, auto_shared: sent })
      setCreated({ token: debt.link_token, sent })
    } catch (err) {
      toast({ title: errorMessage(err), tone: 'error', emoji: '⚠️' })
    } finally {
      setBusy(false)
    }
  }

  if (created) {
    return (
      <div className="flex min-h-dvh flex-col">
        <TopBar back="/" />
        <div className="flex flex-1 flex-col px-5 pb-safe">
          <div className="flex flex-col items-center pt-6 text-center">
            <span className="flex h-20 w-20 animate-pop items-center justify-center rounded-full bg-positive-soft text-positive" aria-hidden="true">
              <Check size={40} strokeWidth={3} />
            </span>
            <h1 className="mt-4 text-[26px] font-extrabold tracking-[-0.03em] text-ink">¡Quedó anotado!</h1>
            <div className="mt-4 w-full rounded-3xl border border-line bg-surface px-5 py-4 shadow-card">
              <p className="text-[14px] font-semibold text-muted">{lent ? 'Te deben' : 'Debes'}</p>
              <p className={`text-[38px] font-extrabold tracking-[-0.045em] tabular ${lent ? 'text-positive' : 'text-ink'}`}>{formatMoney(cents)}</p>
              <p className="mt-1 text-[14px] font-semibold text-ink-2">
                {titleEmoji(concept)} {concept ?? 'Préstamo'}
              </p>
            </div>
            <p className={`mt-4 max-w-[320px] text-[15px] leading-snug ${created.sent ? 'text-muted' : 'font-semibold text-brand-ink'}`}>
              {created.sent
                ? lent
                  ? 'Cuando tu amigo abra el link, verá cómo pagarte. Te avisaremos cuando lo haga.'
                  : 'Cuando tu amigo abra el link y lo confirme, lo verás en Saldos.'
                : 'Falta un paso: envíale el link a tu amigo.'}
            </p>
          </div>
          <div className="mt-auto flex flex-col gap-2.5 pt-8">
            <ShareButtons
              message={debtLinkMessage(lent, cents, 'USD', concept, created.token)}
              link={debtLink(created.token)}
              primaryLabel={created.sent ? 'Enviar otra vez' : 'Enviar por WhatsApp'}
              quiet={created.sent}
              onShared={() => setCreated({ ...created, sent: true })}
            />
            <Button full variant={created.sent ? 'primary' : 'ghost'} onClick={() => navigate('/saldos', { replace: true })}>
              Listo
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar back title="Anotar un préstamo" />
      <div className="flex flex-1 flex-col px-5 pb-safe">
        <div className="pt-2">
          <Segmented
            label="¿Quién prestó?"
            value={direction}
            onChange={setDirection}
            options={[
              { value: 'lent', label: 'Yo presté' },
              { value: 'borrowed', label: 'Me prestaron' },
            ]}
          />
        </div>
        <div className="pt-6 text-center short:pt-4 tiny:pt-2">
          <p className="text-[16px] font-semibold text-ink-2 tiny:sr-only">{lent ? '¿Cuánto le prestaste?' : '¿Cuánto te prestaron?'}</p>
          <AmountInput value={amount} className="mt-2" />
          <p className="mx-auto mt-3 max-w-[300px] text-[14px] leading-snug text-muted short:hidden">
            {lent ? 'Le llega un link por WhatsApp con tus datos para que te pague.' : 'Le llega un link por WhatsApp para que confirme lo que le debes.'}
          </p>
          <p className="mt-2 hidden text-[13.5px] text-muted short:block tiny:hidden">{lent ? 'Le llega un link para que te pague.' : 'Le llega un link para que lo confirme.'}</p>
        </div>

        <div className="mt-6 short:mt-4">
          <p className="mb-2 px-1 text-[14px] font-semibold text-ink-2">
            ¿Para qué fue? <span className="font-normal text-muted">(opcional)</span>
          </p>
          <div className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {concept && !isSuggested && (
              <Chip selected onClick={() => { setDraft(concept); setCustomOpen(true) }} icon="✏️">
                {concept}
              </Chip>
            )}
            {LOAN_CONCEPTS.map((c) => (
              <Chip key={c.label} selected={concept === c.label} onClick={() => setConcept((v) => (v === c.label ? null : c.label))} icon={c.emoji}>
                {c.label}
              </Chip>
            ))}
            <Chip onClick={() => { setDraft(isSuggested || !concept ? '' : concept); setCustomOpen(true) }} icon={<Pencil size={15} />}>
              Otro
            </Chip>
          </div>
        </div>

        <Keypad className="mt-auto pt-4 tiny:pt-2" onKey={(k) => setAmount((v) => keypadInput(v, k, 5))} />

        <Button className="mt-3" full disabled={cents <= 0} loading={busy} icon={<WhatsAppIcon />} onClick={create} aria-label="Anotar y enviar por WhatsApp">
          <span className="max-[359px]:hidden">Anotar y enviar por WhatsApp</span>
          <span className="hidden max-[359px]:inline">Anotar y enviar</span>
        </Button>
      </div>

      <Sheet
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title="¿Para qué fue?"
        description="Así los dos lo reconocen después."
        footer={
          <Button full disabled={!draft.trim()} onClick={() => { setConcept(draft.trim()); setCustomOpen(false) }}>
            Usar este motivo
          </Button>
        }
      >
        <TextField label="Motivo" hideLabel placeholder="Ej. Regalo de Ana" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} autoFocus data-autofocus className="pt-2" />
      </Sheet>
    </div>
  )
}
