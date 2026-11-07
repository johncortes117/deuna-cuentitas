// ─── "Montos diferentes" ─────────────────────────────────────
// Cambias el monto de alguien y lo que falta se reparte solo entre los demás:
// la suma siempre cuadra, sin calculadora (ver lib/split.ts). −/+ de a $1 para
// lo típico ("yo pongo un dólar más") y el teclado propio para un monto exacto.
import { useState } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import type { BillBundle } from '../../lib/types'
import { formatMoney, inputToCents, keypadInput } from '../../lib/money'
import { amountsDifference, amountsFromEqual, amountsFromSaved, rebalance, releaseAmount, setAmount, stepCents } from '../../lib/split'
import type { AmountsState } from '../../lib/split'
import { Sheet } from '../../ui/Sheet'
import { Button } from '../../ui/Button'
import { Avatar } from '../../ui/Avatar'
import { Keypad } from '../../ui/Keypad'
import { cx } from '../../ui/cx'
import { tap } from '../../ui/haptics'
import { grandTotal } from './splitFor'

export function AmountsSheet({ open, onClose, bundle, onSave }: { open: boolean; onClose: () => void; bundle: BillBundle; onSave: (amounts: Record<string, number>) => Promise<void> }) {
  return open ? <AmountsEditor onClose={onClose} bundle={bundle} onSave={onSave} /> : null
}

function AmountsEditor({ onClose, bundle, onSave }: { onClose: () => void; bundle: BillBundle; onSave: (amounts: Record<string, number>) => Promise<void> }) {
  const total = grandTotal(bundle)
  const ids = bundle.members.map((m) => m.id)
  const currency = bundle.bill.currency
  const [state, setState] = useState<AmountsState>(() =>
    amountsFromSaved(total, ids, Object.fromEntries(bundle.members.map((m) => [m.id, m.custom_cents])), bundle.bill.payer_member_id),
  )
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null)
  const [changed, setChanged] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  // Si alguien entra o sale con la hoja abierta, se adapta solo.
  const current = rebalance(state, ids, total)
  const diff = amountsDifference(current, ids, total)

  const apply = (next: AmountsState, id: string) => {
    const moved = new Set(ids.filter((x) => x !== id && next.amounts[x] !== current.amounts[x]))
    setChanged(moved)
    setState(next)
  }

  const save = async () => {
    setBusy(true)
    try {
      await onSave(current.amounts)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      dismissible={!busy}
      title="¿Cuánto pone cada uno?"
      description={`Toca un monto para cambiarlo: lo que falta para ${formatMoney(total, currency)} se reparte solo entre los demás.`}
      footer={
        <div className="flex flex-col gap-2">
          {diff !== 0 && (
            <p className="rounded-2xl bg-danger-soft px-4 py-2.5 text-center text-[14px] font-semibold text-danger" role="alert">
              {diff < 0 ? `Te pasaste por ${formatMoney(-diff, currency)}` : `Faltan ${formatMoney(diff, currency)}`}
            </p>
          )}
          {editing ? (
            <>
              <Keypad
                compact
                onKey={(k) => {
                  const draft = keypadInput(editing.draft === '' ? '0' : editing.draft, k)
                  setEditing({ id: editing.id, draft })
                  apply(setAmount(current, ids, total, editing.id, inputToCents(draft)), editing.id)
                }}
              />
              <Button full onClick={() => setEditing(null)}>
                Listo
              </Button>
            </>
          ) : (
            <Button full disabled={diff !== 0} loading={busy} onClick={save}>
              Guardar montos
            </Button>
          )}
        </div>
      }
    >
      <ul className="-mx-2 pb-2 pt-1">
        {bundle.members.map((m) => {
          const amount = current.amounts[m.id] ?? 0
          const fixed = current.touched.includes(m.id)
          const isEditing = editing?.id === m.id
          return (
            <li key={`${m.id}-${changed.has(m.id) ? amount : 'x'}`} className={cx('flex items-center gap-3 rounded-2xl px-2 py-2.5', isEditing && 'bg-brand-soft', changed.has(m.id) && 'animate-flash')}>
              <Avatar name={m.name} color={m.color} guest={!m.user_id} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink">
                  {m.name}
                  {m.id === bundle.me.member_id && <span className="ml-1.5 text-[12px] font-bold text-muted">Tú</span>}
                </p>
                {fixed ? (
                  <button
                    type="button"
                    onClick={() => {
                      tap(5)
                      if (isEditing) setEditing(null)
                      apply(releaseAmount(current, ids, total, m.id), m.id)
                    }}
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-ink"
                  >
                    <RotateCcw size={12} aria-hidden="true" /> Deshacer
                  </button>
                ) : (
                  <p className="text-[12.5px] text-muted">Se ajusta solo</p>
                )}
              </div>
              <button
                type="button"
                aria-label={`Un dólar menos para ${m.name}`}
                onClick={() => {
                  tap(5)
                  setEditing(null)
                  apply(setAmount(current, ids, total, m.id, stepCents(amount, -1)), m.id)
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-ink active:scale-95"
              >
                <Minus size={18} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => setEditing(isEditing ? null : { id: m.id, draft: '' })}
                aria-label={`Escribir el monto de ${m.name}`}
                className={cx(
                  'min-w-[92px] rounded-xl border px-2 py-2 text-center text-[17px] font-bold tabular transition',
                  isEditing ? 'border-brand bg-surface text-ink' : 'border-line bg-surface text-ink',
                )}
              >
                {isEditing && editing.draft !== '' ? `$${editing.draft}` : formatMoney(amount, currency)}
                {isEditing && <span className="caret" aria-hidden="true" />}
              </button>
              <button
                type="button"
                aria-label={`Un dólar más para ${m.name}`}
                onClick={() => {
                  tap(5)
                  setEditing(null)
                  apply(setAmount(current, ids, total, m.id, stepCents(amount, 1)), m.id)
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-ink active:scale-95"
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </li>
          )
        })}
      </ul>
      {current.touched.length > 0 && !editing && (
        <button
          type="button"
          onClick={() => {
            setChanged(new Set())
            setState(amountsFromEqual(total, ids, bundle.bill.payer_member_id))
          }}
          className="mx-auto mb-2 block py-2 text-[14px] font-semibold text-muted"
        >
          Volver a partes iguales
        </button>
      )}
    </Sheet>
  )
}
