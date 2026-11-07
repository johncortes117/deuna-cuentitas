// ─── Cómo se reparte una cuenta (lógica pura, con pruebas) ───
//
// Tres formas, todas en centavos enteros y con la suma siempre exacta:
//
//  • Partes iguales: los centavos que sobran los pone primero quien pagó la
//    cuenta (así nadie paga un centavo de más por redondear) y después los
//    primeros en llegar.
//  • Montos diferentes: quien arma la cuenta cambia un monto y el resto se
//    reparte solo entre los que no tocó (ver setAmount).
//  • Por productos: cada uno paga lo que marcó; lo compartido se divide entre
//    quienes lo marcaron. Lo que la cuenta tiene de más sobre los productos
//    (IVA, servicio, propina) se reparte en proporción a lo que consumió
//    cada uno: quien pidió más, pone más del servicio.
//
// La app calcula y muestra esto en vivo; al cerrar la división manda las
// partes y la base verifica que estén todos y que sumen el total.

/** Reparte `cents` entre `ids`; los centavos que sobran van a los primeros. */
export function spreadEvenly(cents: number, ids: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  if (ids.length === 0) return out
  const total = Math.max(0, Math.round(cents))
  const base = Math.floor(total / ids.length)
  let extra = total - base * ids.length
  for (const id of ids) {
    out[id] = base + (extra > 0 ? 1 : 0)
    if (extra > 0) extra--
  }
  return out
}

/** Partes iguales. `memberIds` en orden de llegada; `payerId` primero en los centavos. */
export function splitEqual(totalCents: number, memberIds: string[], payerId?: string | null): Record<string, number> {
  const ordered = payerId && memberIds.includes(payerId) ? [payerId, ...memberIds.filter((id) => id !== payerId)] : memberIds
  return spreadEvenly(totalCents, ordered)
}

/**
 * Reparte `cents` en proporción a `weights` (método del mayor resto): la suma
 * es exacta y los centavos sueltos van a quien tenía el mayor decimal; a
 * igual decimal, al primero de la lista.
 */
export function spreadProportionally(cents: number, ids: string[], weights: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  const totalWeight = ids.reduce((acc, id) => acc + Math.max(0, weights[id] ?? 0), 0)
  if (ids.length === 0) return out
  if (totalWeight <= 0) return spreadEvenly(cents, ids)
  const exact = ids.map((id, index) => {
    const value = (cents * Math.max(0, weights[id] ?? 0)) / totalWeight
    return { id, index, floor: Math.floor(value), rest: value - Math.floor(value) }
  })
  let left = cents - exact.reduce((acc, e) => acc + e.floor, 0)
  for (const e of [...exact].sort((a, b) => b.rest - a.rest || a.index - b.index)) {
    if (left <= 0) break
    e.floor += 1
    left -= 1
  }
  for (const e of exact) out[e.id] = e.floor
  return out
}

export interface ItemInput {
  id: string
  priceCents: number
}

export interface ClaimInput {
  itemId: string
  memberId: string
}

export interface ItemsSplit {
  shares: Record<string, number>     // lo que paga cada uno, con su parte de extras
  subtotals: Record<string, number>  // solo productos
  extras: Record<string, number>     // su parte de IVA, servicio y propina
  itemsCents: number                 // suma de todos los productos
  extrasCents: number                // total − productos (puede ser negativo)
  unassigned: string[]               // productos que nadie marcó
  /** Cuánto le toca a cada uno de cada producto (para mostrar el detalle). */
  perItem: Record<string, Record<string, number>>
}

export function splitItems(totalCents: number, memberIds: string[], items: ItemInput[], claims: ClaimInput[]): ItemsSplit {
  const subtotals: Record<string, number> = Object.fromEntries(memberIds.map((id) => [id, 0]))
  const perItem: Record<string, Record<string, number>> = {}
  const unassigned: string[] = []
  let itemsCents = 0

  for (const item of items) {
    itemsCents += item.priceCents
    const claimers = memberIds.filter((id) => claims.some((c) => c.itemId === item.id && c.memberId === id))
    if (claimers.length === 0) {
      unassigned.push(item.id)
      continue
    }
    const parts = spreadEvenly(item.priceCents, claimers)
    perItem[item.id] = parts
    for (const id of claimers) subtotals[id] += parts[id]
  }

  const extrasCents = totalCents - itemsCents
  const extras = extrasCents > 0 ? spreadProportionally(extrasCents, memberIds, subtotals) : Object.fromEntries(memberIds.map((id) => [id, 0]))
  const shares = Object.fromEntries(memberIds.map((id) => [id, subtotals[id] + (extras[id] ?? 0)]))
  return { shares, subtotals, extras, itemsCents, extrasCents, unassigned, perItem }
}

// ─── Montos diferentes con auto-reparto ──────────────────────
//
// La suma SIEMPRE cuadra sola:
//   1. Lo que se toca queda fijo ("touched").
//   2. Lo que falta para el total se reparte en partes iguales entre los que
//      no se tocaron.
//   3. Siempre queda al menos una persona libre que absorbe la diferencia: si
//      se toca a la última libre, se libera la que se tocó hace más tiempo.
//   4. Si lo fijado supera el total, se liberan las más antiguas hasta que
//      cuadre. Solo si UN monto por sí solo supera la cuenta queda un exceso
//      que hay que corregir.

export interface AmountsState {
  amounts: Record<string, number>
  touched: string[] // del más antiguo al más reciente
}

export function amountsFromEqual(totalCents: number, ids: string[], payerId?: string | null): AmountsState {
  return { amounts: splitEqual(totalCents, ids, payerId), touched: [] }
}

/** Recalcula a los libres; también se adapta si alguien entró o salió. */
export function rebalance(state: AmountsState, ids: string[], totalCents: number): AmountsState {
  const touched = state.touched.filter((id) => ids.includes(id))
  const free = ids.filter((id) => !touched.includes(id))
  const fixed = touched.reduce((acc, id) => acc + (state.amounts[id] ?? 0), 0)
  const spread = spreadEvenly(totalCents - fixed, free)
  const amounts: Record<string, number> = {}
  for (const id of ids) amounts[id] = touched.includes(id) ? (state.amounts[id] ?? 0) : (spread[id] ?? 0)
  return { amounts, touched }
}

export function setAmount(state: AmountsState, ids: string[], totalCents: number, id: string, cents: number): AmountsState {
  const amounts = { ...state.amounts, [id]: Math.max(0, Math.round(cents)) }
  let touched = [...state.touched.filter((t) => t !== id && ids.includes(t)), id]
  if (ids.length > 1 && touched.length >= ids.length) touched = touched.slice(1)
  const fixed = () => touched.reduce((acc, t) => acc + (amounts[t] ?? 0), 0)
  while (touched.length > 1 && fixed() > totalCents) touched = touched.slice(1)
  return rebalance({ amounts, touched }, ids, totalCents)
}

export function releaseAmount(state: AmountsState, ids: string[], totalCents: number, id: string): AmountsState {
  return rebalance({ ...state, touched: state.touched.filter((t) => t !== id) }, ids, totalCents)
}

/** total − suma: > 0 faltan, < 0 te pasaste, 0 cuadra. */
export function amountsDifference(state: AmountsState, ids: string[], totalCents: number): number {
  return totalCents - ids.reduce((acc, id) => acc + (state.amounts[id] ?? 0), 0)
}

/** −/+ de a $1: primero al dólar entero más cercano en esa dirección. */
export function stepCents(cents: number, direction: 1 | -1): number {
  if (direction > 0) return Math.floor(cents / 100) * 100 + 100
  return cents % 100 === 0 ? Math.max(0, cents - 100) : Math.floor(cents / 100) * 100
}

/** Estado inicial del editor a partir de lo guardado en la cuenta. */
export function amountsFromSaved(totalCents: number, ids: string[], saved: Record<string, number | null>, payerId?: string | null): AmountsState {
  const complete = ids.every((id) => typeof saved[id] === 'number')
  if (!complete) return amountsFromEqual(totalCents, ids, payerId)
  const amounts = Object.fromEntries(ids.map((id) => [id, saved[id] as number]))
  // Todos fijos menos el último, que absorbe el próximo cambio.
  return rebalance({ amounts, touched: ids.slice(0, -1) }, ids, totalCents)
}

// ─── La división de una cuenta, lista para mostrar o cerrar ───

export type SplitProblem =
  | { kind: 'need_two' }
  | { kind: 'unassigned'; count: number; cents: number }
  | { kind: 'no_items' }
  | { kind: 'items_exceed'; cents: number }
  | { kind: 'amounts_off'; cents: number } // > 0 faltan · < 0 sobran

export interface BillSplitInput {
  mode: 'equal' | 'amounts' | 'items'
  totalCents: number // con propina
  memberIds: string[] // en orden de llegada
  payerId: string | null
  customCents: Record<string, number | null>
  items: ItemInput[]
  claims: ClaimInput[]
}

export interface BillSplit {
  shares: Record<string, number>
  problems: SplitProblem[]
  items?: ItemsSplit
}

export function computeBillSplit(input: BillSplitInput): BillSplit {
  const { mode, totalCents, memberIds, payerId } = input
  const problems: SplitProblem[] = []
  if (memberIds.length < 2) problems.push({ kind: 'need_two' })

  if (mode === 'items') {
    const items = splitItems(totalCents, memberIds, input.items, input.claims)
    if (input.items.length === 0) problems.push({ kind: 'no_items' })
    if (items.unassigned.length > 0) {
      const cents = input.items.filter((i) => items.unassigned.includes(i.id)).reduce((acc, i) => acc + i.priceCents, 0)
      problems.push({ kind: 'unassigned', count: items.unassigned.length, cents })
    }
    if (items.extrasCents < 0) problems.push({ kind: 'items_exceed', cents: -items.extrasCents })
    return { shares: items.shares, problems, items }
  }

  if (mode === 'amounts') {
    const complete = memberIds.every((id) => typeof input.customCents[id] === 'number')
    const shares = complete
      ? Object.fromEntries(memberIds.map((id) => [id, input.customCents[id] as number]))
      : splitEqual(totalCents, memberIds, payerId)
    const diff = totalCents - Object.values(shares).reduce((a, b) => a + b, 0)
    if (diff !== 0) problems.push({ kind: 'amounts_off', cents: diff })
    return { shares, problems }
  }

  return { shares: splitEqual(totalCents, memberIds, payerId), problems }
}
