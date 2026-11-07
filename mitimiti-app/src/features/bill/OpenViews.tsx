// ─── Cuenta abierta: mientras llegan y se arma la división ────
// Anfitrión: invita, elige cómo dividir y cierra con un toque.
// Los demás: ven en vivo cuánto les tocaría y marcan lo que pidieron.
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ChevronDown, Equal, ListChecks, MoreHorizontal, SlidersHorizontal, UserPlus, Wallet } from 'lucide-react'
import type { BillBundle, Member, SplitMode } from '../../lib/types'
import { api, track } from '../../lib/api'
import { errorCode, errorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../lib/avatar'
import type { SplitProblem } from '../../lib/split'
import { Button, IconButton } from '../../ui/Button'
import { Segmented } from '../../ui/Controls'
import { BottomBar, Card, Page, SectionTitle, TopBar } from '../../ui/Layout'
import { useToast } from '../../ui/Toast'
import { success } from '../../ui/haptics'
import { ConfirmSheet } from '../shared/ConfirmSheet'
import { AmountsSheet } from './AmountsSheet'
import { ItemsPanel } from './ItemsPanel'
import type { ItemActions } from './ItemsPanel'
import { EditBillSheet, GuestSheet, HostMenuSheet, MemberSheet, PayerSheet, TipSheet } from './BillSheets'
import { BillSummary, InvitePanel, MemberRow } from './parts'
import { grandTotal, splitFor } from './splitFor'

export interface BillViewProps {
  bundle: BillBundle
  live: boolean
  refresh: () => Promise<void>
  mutate: (update: (b: BillBundle) => BillBundle) => void
}

const MODES: { value: SplitMode; label: string; icon: ReactNode }[] = [
  { value: 'equal', label: 'Iguales', icon: <Equal size={16} aria-hidden="true" /> },
  { value: 'amounts', label: 'Montos', icon: <SlidersHorizontal size={16} aria-hidden="true" /> },
  { value: 'items', label: 'Productos', icon: <ListChecks size={16} aria-hidden="true" /> },
]

const MODE_HINT: Record<SplitMode, string> = {
  equal: 'Todos pagan lo mismo.',
  amounts: 'Cambias un monto y el resto se reparte solo.',
  items: 'Cada uno paga lo que pidió; IVA y servicio en proporción.',
}

function problemText(p: SplitProblem, currency: string, isHost: boolean): string {
  switch (p.kind) {
    case 'need_two':
      return isHost ? 'Comparte el link: hace falta al menos otra persona.' : 'Esperando a que se una alguien más.'
    case 'no_items':
      return 'Agrega los productos de la cuenta.'
    case 'unassigned':
      return p.count === 1 ? `Falta marcar quién pidió 1 producto (${formatMoney(p.cents, currency)}).` : `Falta marcar quién pidió ${p.count} productos (${formatMoney(p.cents, currency)}).`
    case 'items_exceed':
      return `Los productos suman ${formatMoney(p.cents, currency)} más que la cuenta.`
    case 'amounts_off':
      return p.cents > 0 ? `Faltan ${formatMoney(p.cents, currency)} por repartir.` : `Los montos se pasan por ${formatMoney(-p.cents, currency)}.`
  }
}

/** Acciones de productos con cambio inmediato en pantalla (y vuelta atrás si falla). */
function useItemActions({ bundle, refresh, mutate }: BillViewProps): ItemActions {
  const toast = useToast()
  const fail = (err: unknown) => {
    toast({ title: errorMessage(err), tone: 'error', emoji: '⚠️' })
    void refresh()
  }
  return {
    toggleClaim: async (itemId, memberId, on) => {
      mutate((b) => {
        const targets = memberId ? [memberId] : b.members.map((m) => m.id)
        const rest = b.claims.filter((c) => !(c.item_id === itemId && targets.includes(c.member_id)))
        return { ...b, claims: on ? [...rest, ...targets.map((member_id) => ({ item_id: itemId, member_id }))] : rest }
      })
      try {
        await api.setClaim(itemId, memberId, on)
      } catch (err) {
        fail(err)
      }
    },
    addItems: async (items, claim) => {
      await api.addItems(bundle.bill.id, items, claim)
      await refresh()
    },
    updateItem: async (itemId, name, priceCents) => {
      await api.updateItem(itemId, name, priceCents)
      await refresh()
    },
    deleteItem: async (itemId) => {
      mutate((b) => ({ ...b, items: b.items.filter((i) => i.id !== itemId), claims: b.claims.filter((c) => c.item_id !== itemId) }))
      try {
        await api.deleteItem(itemId)
      } catch (err) {
        fail(err)
      }
    },
  }
}

export function HostOpenView(props: BillViewProps) {
  const { bundle, live, refresh, mutate } = props
  const { bill, members } = bundle
  const toast = useToast()
  const navigate = useNavigate()
  const itemActions = useItemActions(props)
  const split = useMemo(() => splitFor(bundle), [bundle])
  const [sheet, setSheet] = useState<'menu' | 'edit' | 'tip' | 'guest' | 'payer' | 'amounts' | 'cancel' | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [busy, setBusy] = useState(false)
  const currency = bill.currency
  const payer = members.find((m) => m.id === bill.payer_member_id)
  const problem = split.problems[0]

  const guard = async (fn: () => Promise<unknown>, after?: () => void) => {
    try {
      await fn()
      after?.()
      await refresh()
    } catch (err) {
      toast({ title: errorMessage(err), tone: 'error', emoji: '⚠️' })
      void refresh()
    }
  }

  const setMode = (mode: SplitMode) => {
    if (mode === bill.split_mode) {
      if (mode === 'amounts') setSheet('amounts')
      return
    }
    mutate((b) => ({ ...b, bill: { ...b.bill, split_mode: mode } }))
    void guard(() => api.updateBill(bill.id, { split_mode: mode }))
    if (mode === 'amounts') setSheet('amounts')
  }

  const lock = async () => {
    if (problem || busy) return
    setBusy(true)
    try {
      await api.lockBill(bill.id, bill.version, split.shares)
      success()
      track('bill_split_done', { mode: bill.split_mode, members: members.length })
      toast({ title: '¡Listo! Cada uno ya ve cuánto le toca', emoji: '✅', tone: 'good' })
      await refresh()
    } catch (err) {
      const code = errorCode(err)
      toast({ title: errorMessage(err), tone: code === 'stale' || code === 'members_changed' ? 'warn' : 'error', emoji: '⚠️' })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  // Lo que pone cada uno de los demás (quien pagó absorbe los centavos sueltos).
  const others = members.filter((m) => m.id !== bill.payer_member_id).map((m) => split.shares[m.id] ?? 0)
  const each = others.length ? Math.min(...others) : 0
  const cta =
    bill.split_mode === 'equal'
      ? members.length >= 2
        ? `Dividir entre ${members.length} · ${others.every((c) => c === each) ? '' : '~'}${formatMoney(each, currency)} c/u`
        : 'Dividir'
      : bill.split_mode === 'amounts'
        ? 'Dividir con estos montos'
        : 'Dividir por productos'

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        back="/"
        title={bill.title}
        right={
          <IconButton label="Opciones de la cuenta" onClick={() => setSheet('menu')}>
            <MoreHorizontal size={24} />
          </IconButton>
        }
      />
      <Page className="flex flex-col pt-1">
        <BillSummary bundle={bundle} live={live} />
        <div className="mt-3">
          <InvitePanel bundle={bundle} compact={members.length >= 2} />
        </div>

        <SectionTitle>¿Cómo dividen?</SectionTitle>
        <Segmented label="Cómo dividir" value={bill.split_mode} onChange={setMode} options={MODES} />
        <p className="mt-2 px-1 text-[14px] text-muted">{MODE_HINT[bill.split_mode]}</p>

        {bill.split_mode === 'items' && split.items && (
          <div className="mt-3">
            <ItemsPanel bundle={bundle} split={split.items} actions={itemActions} />
          </div>
        )}

        <SectionTitle
          right={
            bill.split_mode === 'amounts' ? (
              <button type="button" onClick={() => setSheet('amounts')} className="text-[14px] font-semibold text-brand-ink">
                Cambiar montos
              </button>
            ) : undefined
          }
        >
          En la mesa · {members.length}
        </SectionTitle>
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.id}>
                <MemberRow member={m} bundle={bundle} amount={split.shares[m.id] ?? 0} approx={bill.split_mode !== 'amounts'} onClick={() => setMember(m)} />
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setSheet('guest')} className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left text-[15px] font-semibold text-ink hover:bg-surface-2">
            <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-2 border-dashed border-line-strong text-muted" aria-hidden="true">
              <UserPlus size={18} />
            </span>
            Agregar a alguien sin celular
          </button>
        </Card>

        <BottomBar>
          {problem && <p className="mb-2.5 text-center text-[14px] font-semibold text-warning" role="status">{problemText(problem, currency, true)}</p>}
          <button type="button" onClick={() => setSheet('payer')} className="mx-auto mb-2.5 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] text-muted hover:bg-surface-2">
            <Wallet size={16} aria-hidden="true" /> Pagó la cuenta: <span className="font-semibold text-ink">{payer?.id === bundle.me.member_id ? 'Tú' : payer?.name}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          <Button full disabled={Boolean(problem)} loading={busy} onClick={lock}>
            {cta}
          </Button>
        </BottomBar>
      </Page>

      <HostMenuSheet
        open={sheet === 'menu'}
        onClose={() => setSheet(null)}
        bundle={bundle}
        onEdit={() => setSheet('edit')}
        onTip={() => setSheet('tip')}
        onGuest={() => setSheet('guest')}
        onCancel={() => setSheet('cancel')}
      />
      <EditBillSheet open={sheet === 'edit'} onClose={() => setSheet(null)} bundle={bundle} onSave={(title, total) => guard(() => api.updateBill(bill.id, { title, total_cents: total }), () => setSheet(null))} />
      <TipSheet open={sheet === 'tip'} onClose={() => setSheet(null)} bundle={bundle} onSave={(tip) => guard(() => api.updateBill(bill.id, { tip_cents: tip }), () => setSheet(null))} />
      <GuestSheet open={sheet === 'guest'} onClose={() => setSheet(null)} onSave={(name) => guard(() => api.addGuest(bill.id, name), () => setSheet(null))} />
      <PayerSheet open={sheet === 'payer'} onClose={() => setSheet(null)} bundle={bundle} onPick={(id) => guard(() => api.updateBill(bill.id, { payer_member_id: id }), () => setSheet(null))} />
      <AmountsSheet open={sheet === 'amounts'} onClose={() => setSheet(null)} bundle={bundle} onSave={(amounts) => guard(() => api.setAmounts(bill.id, amounts), () => setSheet(null))} />
      <MemberSheet
        member={member}
        bundle={bundle}
        onClose={() => setMember(null)}
        onRemove={(m) => guard(() => api.removeMember(m.id))}
        onMakePayer={(m) => guard(() => api.updateBill(bill.id, { payer_member_id: m.id }))}
      />
      <ConfirmSheet
        open={sheet === 'cancel'}
        onClose={() => setSheet(null)}
        title="¿Cancelar la cuenta?"
        body="Se cierra para todos y nadie queda debiendo nada por ella."
        confirmLabel="Sí, cancelar"
        cancelLabel="Seguir con la cuenta"
        danger
        onConfirm={() => guard(() => api.cancelBill(bill.id), () => navigate('/', { replace: true }))}
      />
      <span className="sr-only" aria-live="polite">{`${members.length} personas en la cuenta. Total ${formatMoney(grandTotal(bundle), currency)}.`}</span>
    </div>
  )
}

export function MemberOpenView(props: BillViewProps) {
  const { bundle, live } = props
  const { bill, members } = bundle
  const navigate = useNavigate()
  const toast = useToast()
  const itemActions = useItemActions(props)
  const split = useMemo(() => splitFor(bundle), [bundle])
  const [leaving, setLeaving] = useState(false)
  const host = members.find((m) => m.is_host)
  const currency = bill.currency
  const items = split.items
  // Por productos, si todavía no marcaste nada, no te toca nada (aún).
  const mine = items && !(items.subtotals[bundle.me.member_id] > 0) ? 0 : (split.shares[bundle.me.member_id] ?? 0)

  const explanation =
    bill.split_mode === 'equal'
      ? `Si se divide en partes iguales entre ${members.length}.`
      : bill.split_mode === 'amounts'
        ? `${firstName(host?.name ?? '')} puso montos diferentes para cada uno.`
        : items && items.subtotals[bundle.me.member_id] > 0
          ? `${formatMoney(items.subtotals[bundle.me.member_id], currency)} de lo que marcaste${items.extras[bundle.me.member_id] ? ` + ${formatMoney(items.extras[bundle.me.member_id], currency)} de IVA y servicio` : ''}.`
          : 'Marca abajo lo que pediste.'

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar back="/" title={bill.title} />
      <Page className="flex flex-col pt-1">
        <BillSummary bundle={bundle} live={live} />

        <Card className="mt-3 px-5 py-4">
          <p className="text-[14px] font-semibold text-muted">Por ahora te toca</p>
          <p className="mt-0.5 text-[34px] font-extrabold tracking-[-0.04em] text-ink tabular">{formatMoney(mine, currency)}</p>
          <p className="mt-1 text-[14px] leading-snug text-muted">{explanation}</p>
        </Card>

        {bill.split_mode === 'items' && items && (
          <>
            <SectionTitle>Marca lo que pediste</SectionTitle>
            <ItemsPanel bundle={bundle} split={items} actions={itemActions} />
          </>
        )}

        <SectionTitle>En la mesa · {members.length}</SectionTitle>
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.id}>
                <MemberRow member={m} bundle={bundle} amount={split.shares[m.id] ?? 0} approx />
              </li>
            ))}
          </ul>
        </Card>

        <BottomBar>
          <div className="flex items-center justify-center gap-2.5 rounded-2xl bg-surface-2 px-4 py-3.5 text-[15px] font-semibold text-ink-2" role="status">
            <span className="h-2.5 w-2.5 animate-pulse-dot rounded-full bg-brand" aria-hidden="true" />
            Esperando a que {firstName(host?.name ?? '')} divida la cuenta
          </div>
          <button type="button" onClick={() => setLeaving(true)} className="mx-auto mt-2 block px-4 py-2 text-[14px] font-semibold text-muted">
            Salir de la cuenta
          </button>
        </BottomBar>
      </Page>

      <ConfirmSheet
        open={leaving}
        onClose={() => setLeaving(false)}
        title="¿Salir de esta cuenta?"
        body={`Tu parte se reparte entre los demás. Si fue un error, puedes volver a entrar con el link.`}
        confirmLabel="Sí, salir"
        cancelLabel="Quedarme"
        danger
        onConfirm={async () => {
          try {
            await api.removeMember(bundle.me.member_id)
            navigate('/', { replace: true })
          } catch (err) {
            toast({ title: errorMessage(err), tone: 'error', emoji: '⚠️' })
          }
        }}
      />
    </div>
  )
}
