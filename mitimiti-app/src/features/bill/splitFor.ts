import { computeBillSplit } from '../../lib/split'
import type { BillBundle } from '../../lib/types'

/** La división en vivo de una cuenta, con la misma lógica para todos. */
export function splitFor(b: BillBundle) {
  return computeBillSplit({
    mode: b.bill.split_mode,
    totalCents: b.bill.total_cents + b.bill.tip_cents,
    memberIds: b.members.map((m) => m.id),
    payerId: b.bill.payer_member_id,
    customCents: Object.fromEntries(b.members.map((m) => [m.id, m.custom_cents])),
    items: b.items.map((i) => ({ id: i.id, priceCents: i.price_cents })),
    claims: b.claims.map((c) => ({ itemId: c.item_id, memberId: c.member_id })),
  })
}

export const grandTotal = (b: BillBundle) => b.bill.total_cents + b.bill.tip_cents
