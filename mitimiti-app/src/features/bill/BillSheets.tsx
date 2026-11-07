// Hojas del anfitrión: corregir nombre o total, propina, invitado sin app,
// quién pagó en el local y opciones de cada persona.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Coins, Pencil, Trash2, UserPlus, Wallet } from 'lucide-react'
import type { BillBundle, Member } from '../../lib/types'
import { centsToInput, formatMoney, inputToCents, keypadInput, percentOf } from '../../lib/money'
import { Sheet } from '../../ui/Sheet'
import { Button } from '../../ui/Button'
import { Chip, TextField } from '../../ui/Controls'
import { AmountInput, Keypad } from '../../ui/Keypad'
import { Avatar } from '../../ui/Avatar'
import { cx } from '../../ui/cx'

function MenuRow({ icon, title, body, onClick, danger }: { icon: ReactNode; title: string; body?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3.5 rounded-2xl px-2 py-3 text-left transition hover:bg-surface-2">
      <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', danger ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-ink')} aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx('block text-[16px] font-semibold', danger ? 'text-danger' : 'text-ink')}>{title}</span>
        {body && <span className="block text-[13.5px] text-muted">{body}</span>}
      </span>
    </button>
  )
}

export function HostMenuSheet({
  open,
  onClose,
  bundle,
  onEdit,
  onTip,
  onGuest,
  onCancel,
}: {
  open: boolean
  onClose: () => void
  bundle: BillBundle
  onEdit: () => void
  onTip: () => void
  onGuest: () => void
  onCancel: () => void
}) {
  const tip = bundle.bill.tip_cents
  return (
    <Sheet open={open} onClose={onClose} title="Opciones de la cuenta">
      <div className="pb-2 pt-1">
        <MenuRow icon={<Pencil size={19} />} title="Cambiar nombre o total" body={`${bundle.bill.title} · ${formatMoney(bundle.bill.total_cents, bundle.bill.currency)}`} onClick={onEdit} />
        <MenuRow icon={<Coins size={19} />} title={tip > 0 ? 'Cambiar la propina' : 'Agregar propina'} body={tip > 0 ? `${formatMoney(tip, bundle.bill.currency)} sobre la cuenta` : 'Si quieren dejar algo además del servicio'} onClick={onTip} />
        <MenuRow icon={<UserPlus size={19} />} title="Agregar a alguien sin celular" body="Lo anotas tú y cobras su parte" onClick={onGuest} />
        <MenuRow icon={<Trash2 size={19} />} title="Cancelar la cuenta" body="Se cierra para todos" onClick={onCancel} danger />
      </div>
    </Sheet>
  )
}

export function EditBillSheet({ open, onClose, bundle, onSave }: { open: boolean; onClose: () => void; bundle: BillBundle; onSave: (title: string, totalCents: number) => Promise<void> }) {
  return open ? <EditBill onClose={onClose} bundle={bundle} onSave={onSave} /> : null
}

function EditBill({ onClose, bundle, onSave }: { onClose: () => void; bundle: BillBundle; onSave: (title: string, totalCents: number) => Promise<void> }) {
  const [title, setTitle] = useState(bundle.bill.title)
  const [amount, setAmount] = useState(centsToInput(bundle.bill.total_cents))
  const [busy, setBusy] = useState(false)
  const cents = inputToCents(amount)
  return (
    <Sheet
      open
      onClose={onClose}
      dismissible={!busy}
      title="Cambiar nombre o total"
      footer={
        <Button
          full
          disabled={!title.trim() || cents <= 0}
          loading={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onSave(title.trim(), cents)
            } finally {
              setBusy(false)
            }
          }}
        >
          Guardar
        </Button>
      }
    >
      <TextField label="Nombre" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} className="pt-2" />
      <p className="mb-1 mt-4 text-[14px] font-semibold text-ink-2">Total de la cuenta</p>
      <AmountInput value={amount} size="lg" />
      <Keypad compact className="mt-3" onKey={(k) => setAmount((v) => keypadInput(v, k))} />
    </Sheet>
  )
}

const TIP_OPTIONS = [0, 5, 10, 15]

export function TipSheet({ open, onClose, bundle, onSave }: { open: boolean; onClose: () => void; bundle: BillBundle; onSave: (tipCents: number) => Promise<void> }) {
  return open ? <Tip onClose={onClose} bundle={bundle} onSave={onSave} /> : null
}

function Tip({ onClose, bundle, onSave }: { onClose: () => void; bundle: BillBundle; onSave: (tipCents: number) => Promise<void> }) {
  const base = bundle.bill.total_cents
  const currency = bundle.bill.currency
  const initialPct = TIP_OPTIONS.find((p) => percentOf(base, p) === bundle.bill.tip_cents)
  const [pct, setPct] = useState<number | null>(initialPct ?? (bundle.bill.tip_cents ? null : 0))
  const [custom, setCustom] = useState(initialPct === undefined && bundle.bill.tip_cents ? centsToInput(bundle.bill.tip_cents) : '0')
  const [busy, setBusy] = useState(false)
  const tip = pct === null ? inputToCents(custom) : percentOf(base, pct)
  return (
    <Sheet
      open
      onClose={onClose}
      dismissible={!busy}
      title="Propina"
      description="En Ecuador muchas cuentas ya traen el 10% de servicio. Esto es algo extra, si quieren dejarlo."
      footer={
        <Button
          full
          loading={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onSave(tip)
            } finally {
              setBusy(false)
            }
          }}
        >
          {tip > 0 ? `Agregar ${formatMoney(tip, currency)} de propina` : 'Sin propina'}
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2 pb-2 pt-2">
        {TIP_OPTIONS.map((p) => (
          <Chip key={p} selected={pct === p} onClick={() => setPct(p)}>
            {p === 0 ? 'Sin propina' : `${p}% · ${formatMoney(percentOf(base, p), currency)}`}
          </Chip>
        ))}
        <Chip selected={pct === null} onClick={() => setPct(null)}>
          Otro monto
        </Chip>
      </div>
      {pct === null && (
        <div className="pb-2">
          <AmountInput value={custom} size="lg" className="mt-3" />
          <Keypad compact className="mt-2" onKey={(k) => setCustom((v) => keypadInput(v, k))} />
        </div>
      )}
    </Sheet>
  )
}

export function GuestSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      await onSave(name.trim())
      setName('')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title="Alguien sin celular"
      description="Para quien está en la mesa pero no va a abrir el link. Tú cobras su parte y, si quieres, le mandas su link después."
      footer={
        <Button full disabled={!name.trim()} loading={busy} onClick={submit}>
          Agregar a la cuenta
        </Button>
      }
    >
      <TextField
        label="Nombre"
        placeholder="Ej. Abuela"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        autoFocus
        data-autofocus
        className="pt-2"
        onKeyDown={(e) => e.key === 'Enter' && void submit()}
      />
    </Sheet>
  )
}

export function PayerSheet({ open, onClose, bundle, onPick }: { open: boolean; onClose: () => void; bundle: BillBundle; onPick: (memberId: string) => Promise<void> }) {
  const candidates = bundle.members.filter((m) => m.user_id)
  return (
    <Sheet open={open} onClose={onClose} title="¿Quién pagó la cuenta en el local?" description="Los demás le deben su parte a esa persona.">
      <ul className="pb-2 pt-1">
        {candidates.map((m) => {
          const selected = m.id === bundle.bill.payer_member_id
          return (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m.id)} className={cx('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition', selected ? 'bg-surface-2' : 'hover:bg-surface-2')}>
                <Avatar name={m.name} color={m.color} size={40} />
                <span className="flex-1 text-[16px] font-semibold text-ink">
                  {m.name}
                  {m.id === bundle.me.member_id && <span className="ml-1.5 text-[12.5px] font-bold text-muted">Tú</span>}
                </span>
                {selected && <Wallet size={20} className="text-ink" aria-label="Pagó la cuenta" />}
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

export function MemberSheet({
  member,
  bundle,
  onClose,
  onRemove,
  onMakePayer,
}: {
  member: Member | null
  bundle: BillBundle
  onClose: () => void
  onRemove: (m: Member) => Promise<void>
  onMakePayer: (m: Member) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  if (!member) return null
  const isPayer = member.id === bundle.bill.payer_member_id
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      onClose()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open onClose={onClose} dismissible={!busy} title={member.name} description={member.user_id ? 'Está en la cuenta desde su celular.' : 'Lo agregaste tú; no tiene la app.'}>
      <div className="pb-2 pt-1">
        {member.user_id && !isPayer && <MenuRow icon={<Wallet size={19} />} title="Pagó la cuenta en el local" body="Los demás le deberán a esta persona" onClick={() => run(() => onMakePayer(member))} />}
        {!member.is_host && <MenuRow icon={<Trash2 size={19} />} title="Quitar de la cuenta" body="Su parte se reparte entre los demás" onClick={() => run(() => onRemove(member))} danger />}
        {member.is_host && <p className="px-2 py-3 text-[14px] text-muted">Quien crea la cuenta no se puede quitar.</p>}
      </div>
    </Sheet>
  )
}
