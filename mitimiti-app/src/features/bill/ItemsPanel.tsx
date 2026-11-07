// ─── "Lo que pidió cada uno" ─────────────────────────────────
// Cualquiera en la mesa agrega lo que pidió; cada quien marca lo suyo (lo
// compartido se divide entre quienes lo marcan) y el anfitrión puede asignar
// por los que no tienen la app. Lo que la cuenta tiene de más sobre los
// productos (IVA, servicio, propina) se reparte en proporción.
import { useState } from 'react'
import { Check, Plus, Trash2, Users } from 'lucide-react'
import type { BillBundle, Item } from '../../lib/types'
import type { ItemsSplit } from '../../lib/split'
import { formatMoney, parsePrice } from '../../lib/money'
import { errorMessage } from '../../lib/errors'
import { Sheet } from '../../ui/Sheet'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Controls'
import { Avatar, AvatarStack } from '../../ui/Avatar'
import { Card } from '../../ui/Layout'
import { useToast } from '../../ui/Toast'
import { cx } from '../../ui/cx'
import { tap } from '../../ui/haptics'

export interface ItemActions {
  toggleClaim: (itemId: string, memberId: string | null, on: boolean) => Promise<void>
  addItems: (items: { name: string; price_cents: number }[], claim: boolean) => Promise<void>
  updateItem: (itemId: string, name: string, priceCents: number) => Promise<void>
  deleteItem: (itemId: string) => Promise<void>
}

export function ItemsPanel({ bundle, split, actions }: { bundle: BillBundle; split: ItemsSplit; actions: ItemActions }) {
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<Item | null>(null)
  const me = bundle.me.member_id
  const isHost = bundle.me.is_host
  const currency = bundle.bill.currency
  const claimsOf = (itemId: string) => bundle.claims.filter((c) => c.item_id === itemId).map((c) => c.member_id)
  const memberById = new Map(bundle.members.map((m) => [m.id, m]))

  return (
    <>
      {bundle.items.length === 0 ? (
        <Card className="px-5 py-5 text-center">
          <p className="text-[16px] font-bold text-ink">Anota lo que dice la cuenta</p>
          <p className="mx-auto mt-1 max-w-[290px] text-[14px] leading-snug text-muted">
            {isHost ? 'Producto por producto, o que cada uno agregue lo suyo desde su celular.' : 'Agrega lo que pediste; cada uno marca lo suyo.'}
          </p>
          <Button className="mt-4" size="md" icon={<Plus size={18} />} onClick={() => setAdding(true)}>
            Agregar producto
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {bundle.items.map((item) => {
              const claimers = claimsOf(item.id)
              const mine = claimers.includes(me)
              const perPerson = split.perItem[item.id]
              const canEdit = isHost || item.added_by === bundle.members.find((m) => m.id === me)?.user_id
              return (
                <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={mine}
                    aria-label={`Lo pedí: ${item.name}`}
                    onClick={() => {
                      tap(6)
                      void actions.toggleClaim(item.id, me, !mine)
                    }}
                    className={cx(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 transition active:scale-95',
                      mine ? 'border-ink bg-ink text-on-ink' : 'border-line-strong bg-surface text-transparent',
                    )}
                  >
                    <Check size={22} strokeWidth={3} />
                  </button>
                  <button type="button" onClick={() => (canEdit ? setSelected(item) : actions.toggleClaim(item.id, me, !mine))} className="min-w-0 flex-1 text-left">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15.5px] font-semibold text-ink">{item.name}</span>
                      <span className="shrink-0 text-[15.5px] font-bold text-ink tabular">{formatMoney(item.price_cents, currency)}</span>
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      {claimers.length === 0 ? (
                        <span className="text-[13px] font-semibold text-warning">Nadie lo marcó todavía</span>
                      ) : (
                        <>
                          <AvatarStack size={20} max={5} people={claimers.map((id) => ({ name: memberById.get(id)?.name ?? '?', color: memberById.get(id)?.color, guest: !memberById.get(id)?.user_id }))} />
                          <span className="truncate text-[13px] text-muted">
                            {claimers.length === bundle.members.length ? 'Entre todos' : claimers.length === 1 ? memberById.get(claimers[0])?.name : `${claimers.length} personas`}
                            {claimers.length > 1 && perPerson && ` · ${formatMoney(Math.max(...Object.values(perPerson)), currency)} c/u`}
                          </span>
                        </>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center gap-3 border-t border-line px-4 py-3.5 text-left text-[15px] font-semibold text-ink hover:bg-surface-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2" aria-hidden="true">
              <Plus size={18} />
            </span>
            {isHost ? 'Agregar producto' : 'Agregar lo que pedí'}
          </button>
          <div className="space-y-1 border-t border-line bg-surface-2/60 px-4 py-3 text-[13.5px]">
            <p className="flex justify-between text-muted">
              <span>Productos</span>
              <span className="font-semibold text-ink-2 tabular">{formatMoney(split.itemsCents, currency)}</span>
            </p>
            {split.extrasCents > 0 && (
              <p className="flex justify-between text-muted">
                <span>IVA, servicio y propina · en proporción</span>
                <span className="font-semibold text-ink-2 tabular">{formatMoney(split.extrasCents, currency)}</span>
              </p>
            )}
            {split.extrasCents < 0 && (
              <p className="font-semibold text-danger" role="alert">
                Los productos suman {formatMoney(-split.extrasCents, currency)} más que la cuenta. Revisa los precios o el total.
              </p>
            )}
          </div>
        </Card>
      )}

      <AddItemSheet open={adding} onClose={() => setAdding(false)} isHost={isHost} onAdd={actions.addItems} />
      {selected && (
        <ItemSheet
          item={bundle.items.find((i) => i.id === selected.id) ?? selected}
          bundle={bundle}
          claimers={claimsOf(selected.id)}
          onClose={() => setSelected(null)}
          actions={actions}
        />
      )}
    </>
  )
}

function AddItemSheet({ open, onClose, isHost, onAdd }: { open: boolean; onClose: () => void; isHost: boolean; onAdd: ItemActions['addItems'] }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [claim, setClaim] = useState(!isHost)
  const [count, setCount] = useState(0)
  const cents = parsePrice(price)
  const valid = name.trim().length > 0 && cents !== null

  // Sin esperas: el producto sale al servidor y el formulario queda listo
  // para el siguiente al instante (anotar una cuenta larga es de corrido).
  const submit = (e: { preventDefault: () => void }, keepOpen: boolean) => {
    e.preventDefault()
    if (!valid) return
    const item = { name: name.trim(), price_cents: cents! }
    const typed = { name, price }
    setName('')
    setPrice('')
    setCount((c) => c + 1)
    tap(10)
    if (!keepOpen) onClose()
    else (document.getElementById('item-name') as HTMLInputElement | null)?.focus()
    onAdd([item], claim).catch((err) => {
      setCount((c) => c - 1)
      toast({ title: errorMessage(err), body: `No se agregó «${item.name}».`, tone: 'error', emoji: '⚠️' })
      // Si el formulario sigue vacío, se devuelve lo que se había escrito.
      setName((v) => v || typed.name)
      setPrice((v) => v || typed.price)
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title={isHost ? 'Agregar producto' : 'Agregar lo que pedí'} description={count > 0 ? `Llevas ${count} agregado${count === 1 ? '' : 's'}. Sigue con el próximo.` : 'Como aparece en la cuenta. Puedes agregar varios seguidos.'}>
      <form onSubmit={(e) => submit(e, true)} className="flex flex-col gap-3 pb-3 pt-2">
        <TextField id="item-name" label="Producto" placeholder="Ej. Pizza grande" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus data-autofocus enterKeyHint="next" />
        <TextField
          label="Precio"
          placeholder="0,00"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={price && cents === null ? 'Escribe el precio, por ejemplo 4,50' : null}
          enterKeyHint="done"
        />
        <label className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-[15px] font-semibold text-ink">
          <input type="checkbox" checked={claim} onChange={(e) => setClaim(e.target.checked)} className="h-5 w-5 accent-[var(--ink)]" />
          Lo pedí yo
        </label>
        <div className="mt-1 grid grid-cols-2 gap-2.5">
          <Button type="button" variant="secondary" size="md" disabled={!valid} onClick={(e) => submit(e, false)}>
            Agregar
          </Button>
          <Button type="submit" size="md" disabled={!valid}>
            Agregar y otro
          </Button>
        </div>
      </form>
    </Sheet>
  )
}

function ItemSheet({ item, bundle, claimers, onClose, actions }: { item: Item; bundle: BillBundle; claimers: string[]; onClose: () => void; actions: ItemActions }) {
  const toast = useToast()
  const [name, setName] = useState(item.name)
  const [price, setPrice] = useState((item.price_cents / 100).toFixed(2).replace('.', ','))
  const [busy, setBusy] = useState(false)
  const isHost = bundle.me.is_host
  const cents = parsePrice(price)
  const dirty = name.trim() !== item.name || cents !== item.price_cents
  const everyone = claimers.length === bundle.members.length

  const run = async (fn: () => Promise<void>, close = false) => {
    setBusy(true)
    try {
      await fn()
      if (close) onClose()
    } catch (err) {
      toast({ title: errorMessage(err), tone: 'error', emoji: '⚠️' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onClose={onClose} dismissible={!busy} title={item.name} description={isHost ? '¿Quién lo pidió? Marca a todos los que lo compartieron.' : 'Puedes cambiar el nombre o el precio, o quitarlo.'}>
      {isHost && (
        <div className="pb-2 pt-1">
          <button
            type="button"
            onClick={() => run(() => actions.toggleClaim(item.id, null, !everyone))}
            className={cx('mb-2 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] font-semibold transition', everyone ? 'border-ink bg-ink text-on-ink' : 'border-line-strong text-ink')}
          >
            <Users size={20} aria-hidden="true" /> Entre todos
          </button>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {bundle.members.map((m) => {
              const on = claimers.includes(m.id)
              return (
                <li key={m.id}>
                  <button type="button" role="checkbox" aria-checked={on} onClick={() => run(() => actions.toggleClaim(item.id, m.id, !on))} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
                    <Avatar name={m.name} color={m.color} guest={!m.user_id} size={34} />
                    <span className="flex-1 text-[15px] font-semibold text-ink">{m.name}</span>
                    <span className={cx('flex h-7 w-7 items-center justify-center rounded-lg border-2', on ? 'border-ink bg-ink text-on-ink' : 'border-line-strong text-transparent')}>
                      <Check size={16} strokeWidth={3} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <div className="mt-4 grid grid-cols-[1fr_120px] gap-2.5 pb-2">
        <TextField label="Producto" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <TextField label="Precio" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} error={cents === null ? 'Revisa' : null} />
      </div>
      <div className="flex gap-2.5 pb-3 pt-2">
        <Button variant="danger" size="md" icon={<Trash2 size={18} />} disabled={busy} onClick={() => run(() => actions.deleteItem(item.id), true)}>
          Quitar
        </Button>
        <Button className="flex-1" size="md" disabled={!dirty || cents === null || !name.trim()} loading={busy} onClick={() => run(() => actions.updateItem(item.id, name.trim(), cents!), true)}>
          Guardar cambios
        </Button>
      </div>
    </Sheet>
  )
}
