// ─── Tipos de los datos que devuelven las funciones mm_* ─────
// Reflejan exactamente el JSON de supabase/schema.sql.

export type BillStatus = 'open' | 'locked' | 'settled' | 'cancelled'
export type SplitMode = 'equal' | 'amounts' | 'items'
export type DebtStatus = 'pending' | 'open' | 'reported' | 'settled' | 'forgiven' | 'declined' | 'cancelled'
export type PayMethodType = 'deuna' | 'transfer' | 'payphone' | 'cash' | 'other'
export type SettlementStatus = 'reported' | 'confirmed' | 'rejected'

export type PayMethod =
  | { type: 'deuna'; phone: string }
  | { type: 'payphone'; phone: string }
  | { type: 'transfer'; bank: string; account_type: string; account_number: string; holder: string; id_number: string }
  | { type: 'cash' }
  | { type: 'other'; label: string; value: string }

export interface Profile {
  id: string
  name: string
  color: number
  pay_methods: PayMethod[]
  pay_code: string | null
  created_at: string
}

export interface Bill {
  id: string
  code: string
  title: string
  currency: string
  total_cents: number
  tip_cents: number
  split_mode: SplitMode
  status: BillStatus
  host_id: string
  payer_member_id: string | null
  version: number
  created_at: string
  updated_at: string
  locked_at: string | null
  settled_at: string | null
}

export interface Member {
  id: string
  user_id: string | null
  name: string
  color: number
  is_host: boolean
  custom_cents: number | null
  share_cents: number | null
  joined_at: string
}

export interface Item {
  id: string
  name: string
  price_cents: number
  added_by: string | null
}

export interface Claim {
  item_id: string
  member_id: string
}

export interface BillDebt {
  id: string
  member_id: string | null
  debtor_id: string | null
  debtor_name: string
  creditor_id: string | null
  creditor_name: string
  amount_cents: number
  status: DebtStatus
  settlement_id: string | null
  settled_at: string | null
  link_token: string | null
}

export interface PendingSettlement {
  id: string
  from_id: string | null
  from_name: string
  to_id: string | null
  amount_cents: number
  method: PayMethodType | null
  status: SettlementStatus
  created_at: string
}

export interface BillBundle {
  bill: Bill
  me: { member_id: string; is_host: boolean }
  members: Member[]
  items: Item[]
  claims: Claim[]
  debts: BillDebt[]
  settlements: PendingSettlement[]
  payer: { member_id: string; user_id: string | null; name: string; color: number; pay_methods: PayMethod[] } | null
}

export interface BillPreview {
  code: string
  title: string
  currency: string
  total_cents: number
  status: BillStatus
  host_name: string
  host_color: number
  member_count: number
  is_member: boolean
}

export interface HomeBill {
  code: string
  title: string
  status: BillStatus
  currency: string
  total_cents: number
  is_host: boolean
  member_count: number
  i_am_payer: boolean
  payer_name: string | null
  my_debt: { amount_cents: number; status: DebtStatus } | null
  owed: { pending: number; reported: number; done: number; pending_cents: number } | null
  updated_at: string
}

export interface HomeData {
  bills: HomeBill[]
  unread: number
  to_confirm: number
}

export interface LedgerDebt {
  id: string
  kind: 'bill' | 'direct'
  bill_id: string | null
  member_id: string | null
  bill_code: string | null
  bill_title: string | null
  concept: string | null
  debtor_id: string | null
  debtor_name: string
  creditor_id: string | null
  creditor_name: string
  amount_cents: number
  currency: string
  status: DebtStatus
  created_by: string
  settlement_id: string | null
  link_token: string | null
  created_at: string
  responded_at: string | null
  settled_at: string | null
}

export interface LedgerSettlement {
  id: string
  from_id: string | null
  from_name: string
  to_id: string | null
  to_name: string
  amount_cents: number
  currency: string
  method: PayMethodType | null
  status: SettlementStatus
  debt_ids: string[]
  created_at: string
  resolved_at: string | null
}

export interface LedgerPerson {
  name: string
  color: number
  pay_methods: PayMethod[]
}

export interface Ledger {
  debts: LedgerDebt[]
  settlements: LedgerSettlement[]
  people: Record<string, LedgerPerson>
}

export interface DebtPreview {
  id: string
  kind: 'bill' | 'direct'
  status: DebtStatus
  amount_cents: number
  currency: string
  concept: string | null
  created_at: string
  creator_is_creditor: boolean
  creator_name: string
  creator_color: number | null
  counterpart_name: string | null
  claimed: boolean
  bill: { title: string; code: string } | null
  viewer: 'anon' | 'creator' | 'counterparty' | 'other'
  pay_methods: PayMethod[]
}

export type NotificationKind =
  | 'bill_split'
  | 'bill_reopened'
  | 'bill_cancelled'
  | 'bill_settled'
  | 'payment_reported'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'payment_marked'
  | 'debt_forgiven'
  | 'reminder'
  | 'link_accepted'
  | 'link_declined'
  | 'guest_claimed'

export interface AppNotification {
  id: number
  kind: NotificationKind
  actor_id: string | null
  actor_name: string | null
  amount_cents: number | null
  currency: string | null
  bill_id: string | null
  debt_id: string | null
  settlement_id: string | null
  title: string | null
  data: Record<string, unknown>
  created_at: string
  read_at: string | null
}

export interface PayCard {
  name: string
  color: number
  pay_methods: PayMethod[]
  is_me: boolean
}
