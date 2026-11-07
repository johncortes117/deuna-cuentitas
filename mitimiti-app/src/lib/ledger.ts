// ─── Saldos: cuentas claras con cada persona ─────────────────
//
// La gente piensa en personas, no en registros: "Juan me debe $7", aunque
// sean un almuerzo de $10 que me debe y un taxi de $3 que le debo yo. Aquí se
// arma el neto por persona con todo lo que está vivo entre los dos.
//
// Hay tres tipos de "persona":
//  • person: alguien con la app (se le puede pagar, recordar, confirmar).
//  • guest:  alguien que estaba en la mesa sin la app (lo anotó quien pagó);
//            se le manda su link o se marca "ya me pagó".
//  • link:   una deuda anotada a mano cuyo link nadie abrió todavía.
import type { Ledger, LedgerDebt, LedgerSettlement, PayMethod } from './types'
import { tableColors } from './avatar'

export interface PersonBalance {
  key: string
  kind: 'person' | 'guest' | 'link'
  userId: string | null
  name: string
  color: number
  /** > 0 te debe · < 0 le debes. Solo lo pendiente ("open"/"pending"). */
  net: number
  currency: string
  /** Deudas vivas con esta persona, de la más reciente a la más antigua. */
  debts: LedgerDebt[]
  /** Las que se pueden pagar o marcar ahora (status open). */
  openIds: string[]
  /** Avisos de pago que tienes que confirmar tú. */
  toConfirm: LedgerSettlement[]
  /** Avisos tuyos que la otra persona todavía no confirma. */
  awaiting: LedgerSettlement[]
  payMethods: PayMethod[]
  lastAt: string
  /** Para un invitado o un link: el token para reenviarle su link. */
  linkToken: string | null
}

export interface Balances {
  people: PersonBalance[]
  owedToMe: number
  iOwe: number
  toConfirmCount: number
  history: LedgerDebt[]
}

const LIVE = new Set(['pending', 'open', 'reported'])

function counterpartOf(d: LedgerDebt, me: string): { key: string; kind: PersonBalance['kind']; userId: string | null; name: string } {
  if (d.status === 'pending' && d.kind === 'direct') {
    return { key: `link:${d.id}`, kind: 'link', userId: null, name: '' }
  }
  const iAmDebtor = d.debtor_id === me
  const userId = iAmDebtor ? d.creditor_id : d.debtor_id
  const name = iAmDebtor ? d.creditor_name : d.debtor_name
  if (userId) return { key: userId, kind: 'person', userId, name }
  return { key: `member:${d.member_id ?? d.id}`, kind: 'guest', userId: null, name }
}

/**
 * Saldos por persona. `myColor` (el color de quien mira) entra en el reparto
 * de colores para que cada uno tenga el mismo aquí y en las cuentas.
 */
export function buildBalances(ledger: Ledger, me: string, myColor?: number): Balances {
  const map = new Map<string, PersonBalance>()
  const history: LedgerDebt[] = []

  for (const d of ledger.debts) {
    if (!LIVE.has(d.status)) {
      history.push(d)
      continue
    }
    const cp = counterpartOf(d, me)
    let p = map.get(cp.key)
    if (!p) {
      const person = cp.userId ? ledger.people[cp.userId] : undefined
      p = {
        key: cp.key,
        kind: cp.kind,
        userId: cp.userId,
        name: person?.name ?? cp.name,
        color: person?.color ?? 0,
        net: 0,
        currency: d.currency,
        debts: [],
        openIds: [],
        toConfirm: [],
        awaiting: [],
        payMethods: person?.pay_methods ?? [],
        lastAt: d.created_at,
        linkToken: null,
      }
      map.set(cp.key, p)
    }
    p.debts.push(d)
    if (d.created_at > p.lastAt) p.lastAt = d.created_at
    if (d.status === 'open' || d.status === 'pending') {
      p.net += d.creditor_id === me ? d.amount_cents : d.debtor_id === me ? -d.amount_cents : 0
    }
    if (d.status === 'open') p.openIds.push(d.id)
    if (cp.kind !== 'person' && d.link_token) p.linkToken = d.link_token
  }

  for (const s of ledger.settlements) {
    if (s.status !== 'reported') continue
    const otherId = s.to_id === me ? s.from_id : s.to_id
    const p = otherId ? map.get(otherId) : undefined
    if (!p) continue
    if (s.to_id === me) p.toConfirm.push(s)
    else p.awaiting.push(s)
    if (s.created_at > p.lastAt) p.lastAt = s.created_at
  }

  const people = [...map.values()].filter((p) => p.net !== 0 || p.toConfirm.length > 0 || p.awaiting.length > 0 || p.kind === 'link')
  people.sort(
    (a, b) =>
      b.toConfirm.length - a.toConfirm.length ||
      Math.abs(b.net) - Math.abs(a.net) ||
      b.lastAt.localeCompare(a.lastAt),
  )

  // Nadie repite color en la lista (los links sin abrir no llevan avatar).
  const withAvatar = people.filter((p) => p.kind !== 'link')
  const colors = tableColors([...(myColor === undefined ? [] : [{ key: me, color: myColor }]), ...withAvatar.map((p) => ({ key: p.key, color: p.color }))])
  for (const p of withAvatar) p.color = colors.get(p.key) ?? p.color

  return {
    people,
    owedToMe: people.reduce((acc, p) => acc + Math.max(0, p.net), 0),
    iOwe: people.reduce((acc, p) => acc + Math.max(0, -p.net), 0),
    toConfirmCount: people.reduce((acc, p) => acc + p.toConfirm.length, 0),
    history: history.sort((a, b) => (b.settled_at ?? b.responded_at ?? b.created_at).localeCompare(a.settled_at ?? a.responded_at ?? a.created_at)),
  }
}

/** De dónde viene una deuda, en palabras: la cuenta o lo que se anotó. */
export function debtOrigin(d: Pick<LedgerDebt, 'kind' | 'bill_title' | 'concept'>): string {
  if (d.kind === 'bill') return d.bill_title ?? d.concept ?? 'Cuenta'
  return d.concept || 'Préstamo'
}

/** "Almuerzo, Taxi y 2 más" */
export function originsLabel(debts: Pick<LedgerDebt, 'kind' | 'bill_title' | 'concept'>[]): string {
  const names = [...new Set(debts.map(debtOrigin))]
  if (names.length <= 2) return names.join(' y ')
  return `${names.slice(0, 2).join(', ')} y ${names.length - 2} más`
}
