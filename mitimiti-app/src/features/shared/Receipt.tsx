// ─── Perdonar y recibos para compartir ───────────────────────
// La hoja para perdonar (con frase opcional), la vista previa de una tarjeta
// con el sello que cae y la vista del recibo de una deuda perdonada.
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../lib/avatar'
import { CARD_HEIGHT, CARD_WIDTH, STAMP, STAMP_POSITION, renderReceiptCard } from '../../lib/receiptCard'
import type { ReceiptCard } from '../../lib/receiptCard'
import { APP_URL } from '../../lib/env'
import { appDomain, openWhatsApp, shareImage } from '../../lib/share'
import { settledElapsedLabel, shortDate } from '../../lib/dates'
import { groupElapsedLabel } from '../../lib/groupPrize'
import { FORGIVE_NOTES, TEMPLATES, fillTemplate } from '../../lib/templates'
import { track } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { Sheet } from '../../ui/Sheet'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Controls'
import { useToast } from '../../ui/Toast'
import { cx } from '../../ui/cx'

/** ¿Perdonas los $5,00 de Luis? — con frases rápidas opcionales. */
export function ForgiveSheet({
  open,
  onClose,
  debtorName,
  amountCents,
  currency,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  debtorName: string
  amountCents: number
  currency: string
  /** Debe lanzar si falla (la hoja queda abierta). */
  onConfirm: (note: string | null) => Promise<void>
}) {
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title={`¿Perdonas los ${formatMoney(amountCents, currency)} de ${firstName(debtorName)}?`}
      description="La deuda se marcará como perdonada y ya no aparecerá pendiente."
      footer={
        <div className="flex flex-col gap-2">
          <Button
            full
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm(note)
                setNote(null)
              } catch (err) {
                toast({ title: errorMessage(err), tone: 'error', emoji: '⚠️' })
              } finally {
                setBusy(false)
              }
            }}
          >
            Sí, perdonar
          </Button>
          <Button full variant="ghost" size="md" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
        </div>
      }
    >
      <p className="mb-2.5 mt-2 text-[14px] font-semibold text-ink-2">
        Una frase para la tarjeta <span className="font-normal text-muted">(opcional)</span>
      </p>
      <div className="flex flex-wrap gap-2 pb-2" role="radiogroup" aria-label="Frase para la tarjeta">
        {FORGIVE_NOTES.map((n) => (
          <Chip key={n} selected={note === n} onClick={() => setNote((v) => (v === n ? null : n))}>
            {n}
          </Chip>
        ))}
      </div>
    </Sheet>
  )
}

/**
 * La tarjeta como imagen. El sello no viene dibujado: se pone encima y "cae"
 * al aparecer (sin animación si la persona pidió menos movimiento).
 */
export function ReceiptPreview({ card, onReady }: { card: ReceiptCard; onReady?: (ok: boolean) => void }) {
  const [src, setSrc] = useState<string | null>(null)
  const key = JSON.stringify(card)
  useEffect(() => {
    let alive = true
    let url: string | null = null
    renderReceiptCard(JSON.parse(key) as ReceiptCard, { stamp: false, domain: appDomain() })
      .then((blob) => {
        if (!alive) return
        url = URL.createObjectURL(blob)
        setSrc(url)
        onReady?.(true)
      })
      .catch(() => alive && onReady?.(false))
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
    // onReady es solo un aviso; la imagen depende de la tarjeta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const stamp = STAMP[card.kind]
  const stampStyle: CSSProperties = {
    left: `${STAMP_POSITION.x * 100}%`,
    top: `${STAMP_POSITION.y * 100}%`,
    color: stamp.color,
    background: stamp.bg,
    borderColor: stamp.color,
    // Mismo tamaño relativo que en la imagen (44 px de 1080).
    fontSize: `${(44 / CARD_WIDTH) * 100}cqw`,
    borderWidth: `${(6 / CARD_WIDTH) * 100}cqw`,
    borderRadius: `${(22 / CARD_WIDTH) * 100}cqw`,
    padding: `0 ${(40 / CARD_WIDTH) * 100}cqw`,
    height: `${(92 / CARD_WIDTH) * 100}cqw`,
    letterSpacing: `${(6 / CARD_WIDTH) * 100}cqw`,
    ['--stamp-rotate' as string]: `${STAMP_POSITION.rotate}deg`,
  }
  return (
    <div className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-[22px] shadow-card [container-type:inline-size]" style={{ aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}` }}>
      {src ? (
        <img src={src} alt={describeCard(card)} className="block h-full w-full" />
      ) : (
        <div className="h-full w-full animate-pulse bg-surface-2" aria-hidden="true" />
      )}
      {src && (
        <span className="animate-stamp absolute flex items-center justify-center border-solid font-extrabold leading-none" style={stampStyle} aria-hidden="true">
          {stamp.text}
        </span>
      )}
    </div>
  )
}

function describeCard(card: ReceiptCard): string {
  if (card.kind === 'settled') return `Recibo: ${card.debtorName} le pagó ${card.amount} a ${card.creditorName} por ${card.concept}. ${card.elapsed}.`
  if (card.kind === 'group') {
    const prize = card.prize ? ` ${card.prize.label}: ${card.prize.value}.` : ''
    return `Recibo grupal: ${card.planName}, ${card.participants.length} panas${card.hideAmount ? '' : `, ${card.total}`}.${prize}`
  }
  return card.hideAmount
    ? `Tarjeta: ${card.creditorName} perdonó una cuenta de ${card.concept}.`
    : `Tarjeta: ${card.creditorName} le perdonó ${card.amount} a ${card.debtorName} por ${card.concept}.`
}

export interface ForgivenData {
  creditorName: string
  debtorName: string
  concept: string
  amountCents: number
  currency: string
  note: string | null
  /** Quién la mira: quien perdonó (por defecto) o a quien le perdonaron. */
  viewer?: 'creditor' | 'debtor'
}

export interface SettledData {
  creditorName: string
  debtorName: string
  concept: string
  amountCents: number
  currency: string
  /** Desde cuándo existía la deuda y cuándo se saldó (ISO). */
  createdAt: string
  settledAt: string
  viewer?: 'creditor' | 'debtor'
}

/** Después de perdonar: la tarjeta, ocultar el monto y compartir. */
export function ForgivenReceiptSheet({ data, onClose }: { data: ForgivenData | null; onClose: () => void }) {
  const toast = useToast()
  const [hideAmount, setHideAmount] = useState(false)
  const [busy, setBusy] = useState<'primary' | 'secondary' | null>(null)
  if (!data) return null
  const debtor = firstName(data.debtorName)
  const card = (hide: boolean): ReceiptCard => ({
    kind: 'forgiven',
    creditorName: firstName(data.creditorName),
    debtorName: debtor,
    concept: data.concept,
    amount: formatMoney(data.amountCents, data.currency),
    note: data.note,
    hideAmount: hide,
  })

  const share = async (which: 'primary' | 'secondary') => {
    const hide = which === 'secondary' || hideAmount
    setBusy(which)
    try {
      const blob = await renderReceiptCard(card(hide), { domain: appDomain() })
      const text = hide
        ? fillTemplate(TEMPLATES.forgivenPublic, { appUrl: APP_URL })
        : fillTemplate(TEMPLATES.forgiven, { debtorName: debtor, concept: data.concept })
      const result = await shareImage(blob, 'mitimiti-perdonada.png', { title: 'Cuenta perdonada · MitiMiti', text })
      if (result === 'downloaded') toast({ title: 'Imagen guardada. Ya puedes enviarla por WhatsApp.', emoji: '🖼️', tone: 'good' })
      if (result !== 'cancelled') track('forgiven_card_shared', { hide_amount: hide, how: result })
    } catch {
      toast({ title: 'No pudimos crear la imagen. Intenta de nuevo.', tone: 'error', emoji: '⚠️' })
    } finally {
      setBusy(null)
    }
  }

  const asDebtor = data.viewer === 'debtor'
  return (
    <Sheet
      open
      onClose={onClose}
      dismissible={!busy}
      title={asDebtor ? `¡${firstName(data.creditorName)} te perdonó!` : '¡Cuenta perdonada!'}
      description={asDebtor ? 'Ya no debes esto. Puedes compartir la tarjeta.' : `${debtor} ya no te debe esto. Mándale la tarjeta.`}
    >
      <div className="flex flex-col gap-4 pb-4 pt-2">
        <ReceiptPreview card={card(hideAmount)} />
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          <span className="text-[15px] font-semibold text-ink">Ocultar monto</span>
          <Switch checked={hideAmount} onChange={setHideAmount} label="Ocultar monto" />
        </label>
        <div className="flex flex-col gap-2">
          {!asDebtor && (
            <Button full loading={busy === 'primary'} disabled={busy !== null} onClick={() => void share('primary')}>
              Avisarle a {debtor} por WhatsApp
            </Button>
          )}
          <Button full variant={asDebtor ? 'primary' : 'secondary'} size={asDebtor ? 'lg' : 'md'} loading={busy === 'secondary'} disabled={busy !== null} onClick={() => void share('secondary')}>
            Compartir sin monto
          </Button>
          <Button full variant="ghost" size="md" onClick={onClose} disabled={busy !== null}>
            Listo
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

/** Después de confirmar un pago: el comprobante para el chat 1 a 1 (siempre con monto). */
export function SettledReceiptSheet({ data, onClose }: { data: SettledData | null; onClose: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!data) return null
  const debtor = firstName(data.debtorName)
  const creditor = firstName(data.creditorName)
  const asDebtor = data.viewer === 'debtor'
  const other = asDebtor ? creditor : debtor
  const card: ReceiptCard = {
    kind: 'settled',
    creditorName: creditor,
    debtorName: debtor,
    concept: data.concept,
    amount: formatMoney(data.amountCents, data.currency),
    date: shortDate(data.settledAt),
    elapsed: settledElapsedLabel(data.createdAt, data.settledAt),
  }
  const send = async () => {
    setBusy(true)
    try {
      const blob = await renderReceiptCard(card, { domain: appDomain() })
      const text = asDebtor
        ? fillTemplate(TEMPLATES.settledByDebtor, { creditorName: creditor, concept: data.concept })
        : fillTemplate(TEMPLATES.settled, { debtorName: debtor, concept: data.concept })
      const result = await shareImage(blob, 'mitimiti-a-mano.png', { title: 'Quedamos a mano · MitiMiti', text })
      if (result === 'downloaded') {
        // Sin compartir archivos (computador): la imagen queda guardada y se abre el chat con el texto.
        openWhatsApp(text)
        toast({ title: 'Imagen guardada. Adjúntala en el chat de WhatsApp.', emoji: '🖼️', tone: 'good' })
      }
      if (result !== 'cancelled') track('settled_receipt_shared', { how: result, viewer: data.viewer ?? 'creditor' })
    } catch {
      toast({ title: 'No pudimos crear la imagen. Intenta de nuevo.', tone: 'error', emoji: '⚠️' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet
      open
      onClose={onClose}
      dismissible={!busy}
      title="¡Quedamos a mano!"
      description={asDebtor ? `Le pagaste a ${creditor}. Aquí está tu comprobante.` : `${debtor} ya te pagó. Mándale el comprobante.`}
    >
      <div className="flex flex-col gap-4 pb-4 pt-2">
        <ReceiptPreview card={card} />
        <div className="flex flex-col gap-2">
          <Button full loading={busy} onClick={() => void send()}>
            Enviar comprobante a {other}
          </Button>
          <Button full variant="ghost" size="md" onClick={onClose} disabled={busy}>
            Cerrar
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-8 w-[52px] shrink-0 rounded-full transition-colors', checked ? 'bg-cta' : 'bg-line-strong')}
    >
      <span className={cx('absolute top-1 h-6 w-6 rounded-full bg-surface shadow transition-transform', checked ? 'translate-x-[24px]' : 'translate-x-1')} />
    </button>
  )
}

export interface GroupData {
  planName: string
  hostName: string
  participants: string[]
  totalCents: number
  currency: string
  /** Cuándo se creó la cuenta y cuándo quedó cuadrada (ISO). */
  createdAt: string
  settledAt: string
  prize: { icon: string; label: string; value: string } | null
}

/** "Contarle al grupo": el recibo de la cuenta cerrada, con o sin monto. */
export function GroupReceiptSheet({ data, onClose }: { data: GroupData | null; onClose: () => void }) {
  const toast = useToast()
  const [hideAmount, setHideAmount] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!data) return null
  const card = (hide: boolean): ReceiptCard => ({
    kind: 'group',
    planName: data.planName,
    hostName: firstName(data.hostName),
    participants: data.participants.map(firstName),
    total: formatMoney(data.totalCents, data.currency),
    date: shortDate(data.settledAt),
    elapsed: groupElapsedLabel(data.createdAt, data.settledAt),
    prize: data.prize,
    hideAmount: hide,
  })
  const share = async () => {
    setBusy(true)
    try {
      const blob = await renderReceiptCard(card(hideAmount), { domain: appDomain() })
      const text = fillTemplate(TEMPLATES.groupSettled, { planName: data.planName })
      const result = await shareImage(blob, 'mitimiti-todo-cuadrado.png', { title: '¡Todo cuadrado! · MitiMiti', text })
      if (result === 'downloaded') toast({ title: 'Imagen guardada. Ya puedes enviarla al grupo.', emoji: '🖼️', tone: 'good' })
      if (result !== 'cancelled') track('group_receipt_shared', { hide_amount: hideAmount, how: result, prize: data.prize?.label ?? null })
    } catch {
      toast({ title: 'No pudimos crear la imagen. Intenta de nuevo.', tone: 'error', emoji: '⚠️' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open onClose={onClose} dismissible={!busy} title="Contarle al grupo" description="Así quedó la cuenta. Compártela en el chat del grupo.">
      <div className="flex flex-col gap-4 pb-4 pt-2">
        <ReceiptPreview card={card(hideAmount)} />
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          <span className="text-[15px] font-semibold text-ink">Ocultar monto</span>
          <Switch checked={hideAmount} onChange={setHideAmount} label="Ocultar monto" />
        </label>
        <div className="flex flex-col gap-2">
          <Button full loading={busy} onClick={() => void share()}>
            Compartir en el grupo
          </Button>
          <Button full variant="ghost" size="md" onClick={onClose} disabled={busy}>
            Listo
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
