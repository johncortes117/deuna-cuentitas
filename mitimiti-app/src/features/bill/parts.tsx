// Piezas de la pantalla de una cuenta que se repiten en todos sus estados.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Copy, UserPlus } from 'lucide-react'
import type { BillBundle, Member } from '../../lib/types'
import { formatMoney } from '../../lib/money'
import { copyText, billLink, inviteMessage } from '../../lib/share'
import { track } from '../../lib/api'
import { Avatar } from '../../ui/Avatar'
import { Card } from '../../ui/Layout'
import { Sheet } from '../../ui/Sheet'
import { StatusPill } from '../../ui/Controls'
import { cx } from '../../ui/cx'
import { tap } from '../../ui/haptics'
import { QrCode } from '../shared/QrCode'
import { ShareButtons } from '../shared/ShareButtons'
import { titleEmoji } from '../shared/titles'
import { grandTotal } from './splitFor'

export function LiveDot({ live }: { live: boolean }) {
  if (!live) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-positive">
      <span className="h-2 w-2 animate-pulse-dot rounded-full bg-positive-fill" aria-hidden="true" />
      En vivo
    </span>
  )
}

/** Tarjeta de arriba: qué se paga, cuánto y de quién es la cuenta. */
export function BillSummary({ bundle, live, children }: { bundle: BillBundle; live: boolean; children?: ReactNode }) {
  const { bill, members } = bundle
  const host = members.find((m) => m.is_host)
  return (
    <Card className="px-5 pb-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[15px] font-semibold text-muted">
          <span aria-hidden="true">{titleEmoji(bill.title)}</span> {bill.title}
        </p>
        <LiveDot live={live} />
      </div>
      <p className="mt-1 text-[42px] font-extrabold leading-none tracking-[-0.045em] text-ink tabular">{formatMoney(grandTotal(bundle), bill.currency)}</p>
      <p className="mt-2 text-[14px] text-muted">
        {bill.tip_cents > 0 && <>Incluye {formatMoney(bill.tip_cents, bill.currency)} de propina · </>}
        {bundle.me.is_host ? 'Tu cuenta' : `Cuenta de ${host?.name ?? ''}`} · {members.length} {members.length === 1 ? 'persona' : 'personas'}
      </p>
      {children}
    </Card>
  )
}

/** El código grande para dictarlo en la mesa, con copiar. */
function CodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(code)) {
          tap(10)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        }
      }}
      className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 transition active:scale-95"
      aria-label={`Código ${code.split('').join(' ')}. Copiar`}
    >
      <span className="text-[13px] font-semibold text-muted">Código</span>
      <span className="text-[17px] font-extrabold tracking-[0.18em] text-ink">{code}</span>
      <Copy size={15} className={copied ? 'text-positive' : 'text-muted'} aria-hidden="true" />
    </button>
  )
}

/** Invitar: QR para la mesa, WhatsApp para quien no está, código para dictar. */
export function InvitePanel({ bundle, compact }: { bundle: BillBundle; compact: boolean }) {
  const [open, setOpen] = useState(false)
  const { bill } = bundle
  const message = inviteMessage(bill.title, grandTotal(bundle), bill.currency, bill.code)
  const onShared = (channel: string) => track('invite_shared', { channel })

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong px-4 py-3 text-left transition hover:bg-surface-2 active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-ink" aria-hidden="true">
            <UserPlus size={20} />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-semibold text-ink">Invitar a alguien más</span>
            <span className="block text-[13px] text-muted">QR, WhatsApp o el código {bill.code}</span>
          </span>
        </button>
        <InviteSheet open={open} onClose={() => setOpen(false)} bundle={bundle} message={message} onShared={onShared} />
      </>
    )
  }

  return (
    <Card className="px-5 py-5">
      <div className="flex items-start gap-4">
        <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-2xl transition active:scale-95" aria-label="Ver el QR en grande">
          <span className="block rounded-2xl border border-line bg-white p-1.5">
            <QrMini url={billLink(bill.code)} />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold leading-tight text-ink">Invita a la mesa</p>
          <p className="mt-1 text-[14px] leading-snug text-muted">Que escaneen el QR con la cámara, o mándales el link. Nadie tiene que descargar nada.</p>
        </div>
      </div>
      <div className="mt-4 flex justify-center">
        <CodeChip code={bill.code} />
      </div>
      <div className="mt-4">
        <ShareButtons message={message} link={billLink(bill.code)} onShared={onShared} />
      </div>
      <InviteSheet open={open} onClose={() => setOpen(false)} bundle={bundle} message={message} onShared={onShared} />
    </Card>
  )
}

function QrMini({ url }: { url: string }) {
  return <QrCode url={url} size={88} framed={false} />
}

function InviteSheet({ open, onClose, bundle, message, onShared }: { open: boolean; onClose: () => void; bundle: BillBundle; message: string; onShared: (c: string) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Invita a la mesa" description="Escanean con la cámara del celular y entran con su nombre.">
      <div className="flex flex-col items-center gap-4 pb-4 pt-3">
        <QrCode url={billLink(bundle.bill.code)} size={232} />
        <CodeChip code={bundle.bill.code} />
        <div className="w-full">
          <ShareButtons message={message} link={billLink(bundle.bill.code)} onShared={onShared} />
        </div>
      </div>
    </Sheet>
  )
}

/** Etiquetas de una persona en la cuenta. */
function memberTags(m: Member, bundle: BillBundle): string[] {
  const tags: string[] = []
  if (m.id === bundle.bill.payer_member_id) tags.push('Pagó la cuenta')
  else if (m.is_host) tags.push('Anfitrión')
  if (!m.user_id) tags.push('Sin app')
  return tags
}

export function MemberRow({
  member,
  bundle,
  amount,
  approx = false,
  right,
  onClick,
  flash,
}: {
  member: Member
  bundle: BillBundle
  amount?: number
  approx?: boolean
  right?: ReactNode
  onClick?: () => void
  flash?: boolean
}) {
  const isMe = member.id === bundle.me.member_id
  const tags = memberTags(member, bundle)
  // Por productos, mientras alguien no marca nada no tiene un monto que mostrar.
  const nothingMarked =
    bundle.bill.status === 'open' && bundle.bill.split_mode === 'items' && bundle.items.length > 0 && !bundle.claims.some((c) => c.member_id === member.id)
  const content = (
    <>
      <Avatar name={member.name} color={member.color} guest={!member.user_id} size={42} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[16px] font-semibold text-ink">{member.name}</span>
          {isMe && <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11.5px] font-bold text-muted">Tú</span>}
        </span>
        {tags.length > 0 && <span className="block truncate text-[13px] text-muted">{tags.join(' · ')}</span>}
      </span>
      {right ??
        (amount !== undefined &&
          (nothingMarked ? (
            <span className="shrink-0 text-[13.5px] font-semibold text-subtle">Nada marcado</span>
          ) : (
            <span className={cx('shrink-0 text-[16px] font-bold tabular', approx ? 'text-ink-2' : 'text-ink')}>
              {approx && <span className="mr-0.5 text-muted">~</span>}
              {formatMoney(amount, bundle.bill.currency)}
            </span>
          )))}
    </>
  )
  const cls = cx('flex w-full items-center gap-3 px-4 py-3 text-left', flash && 'animate-flash')
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(cls, 'transition hover:bg-surface-2 active:bg-surface-2')}>
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  )
}

export function DebtStatusPill({ status }: { status: string }) {
  if (status === 'settled' || status === 'forgiven') return <StatusPill tone="good">{status === 'forgiven' ? 'Perdonado' : 'Pagó ✓'}</StatusPill>
  if (status === 'reported') return <StatusPill tone="warn">Por confirmar</StatusPill>
  return <StatusPill tone="muted">Pendiente</StatusPill>
}
