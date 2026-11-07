// ─── API: una función por operación, con tipos ───────────────
// Todas pasan por las funciones mm_* de la base (ver supabase/schema.sql).
import { supabase } from './supabase'
import { isConfigured } from './env'
import { ApiError, toApiError } from './errors'
import type {
  BillBundle,
  BillPreview,
  DebtPreview,
  AppNotification,
  HomeData,
  Ledger,
  PayCard,
  PayMethod,
  PayMethodType,
  Profile,
  SplitMode,
} from './types'

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (!isConfigured) throw new ApiError('not_configured')
  let result
  try {
    result = await supabase.rpc(fn, args)
  } catch (err) {
    throw toApiError(err as Error)
  }
  if (result.error) throw toApiError(result.error)
  return result.data as T
}

export const api = {
  // Perfil
  me: () => rpc<Profile | null>('mm_me'),
  saveProfile: (name: string, payMethods?: PayMethod[]) =>
    rpc<Profile>('mm_save_profile', payMethods ? { p_name: name, p_pay_methods: payMethods } : { p_name: name }),
  ensurePayCode: () => rpc<string>('mm_ensure_pay_code'),
  payCard: (code: string) => rpc<PayCard | null>('mm_pay_card', { p_code: code }),

  // Cuentas
  createBill: (title: string, totalCents: number) => rpc<{ id: string; code: string }>('mm_create_bill', { p_title: title, p_total_cents: totalCents }),
  billPreview: (code: string) => rpc<BillPreview | null>('mm_bill_preview', { p_code: code }),
  joinBill: (code: string) => rpc<{ id: string; code: string }>('mm_join_bill', { p_code: code }),
  getBill: (code: string) => rpc<BillBundle>('mm_get_bill', { p_code: code }),
  updateBill: (bill: string, patch: { title?: string; total_cents?: number; tip_cents?: number; split_mode?: SplitMode; payer_member_id?: string }) =>
    rpc<null>('mm_update_bill', {
      p_bill: bill,
      ...(patch.title !== undefined && { p_title: patch.title }),
      ...(patch.total_cents !== undefined && { p_total_cents: patch.total_cents }),
      ...(patch.tip_cents !== undefined && { p_tip_cents: patch.tip_cents }),
      ...(patch.split_mode !== undefined && { p_split_mode: patch.split_mode }),
      ...(patch.payer_member_id !== undefined && { p_payer_member_id: patch.payer_member_id }),
    }),
  addGuest: (bill: string, name: string) => rpc<string>('mm_add_guest', { p_bill: bill, p_name: name }),
  removeMember: (member: string) => rpc<null>('mm_remove_member', { p_member: member }),
  setAmounts: (bill: string, amounts: Record<string, number>) => rpc<null>('mm_set_amounts', { p_bill: bill, p_amounts: amounts }),
  addItems: (bill: string, items: { name: string; price_cents: number }[], claim = false) =>
    rpc<string[]>('mm_add_items', { p_bill: bill, p_items: items, p_claim: claim }),
  updateItem: (item: string, name: string, priceCents: number) => rpc<null>('mm_update_item', { p_item: item, p_name: name, p_price_cents: priceCents }),
  deleteItem: (item: string) => rpc<null>('mm_delete_item', { p_item: item }),
  setClaim: (item: string, member: string | null, on: boolean) => rpc<null>('mm_set_claim', { p_item: item, p_member: member, p_on: on }),
  lockBill: (bill: string, version: number, shares: Record<string, number>) =>
    rpc<null>('mm_lock_bill', { p_bill: bill, p_version: version, p_shares: shares }),
  unlockBill: (bill: string) => rpc<null>('mm_unlock_bill', { p_bill: bill }),
  cancelBill: (bill: string) => rpc<null>('mm_cancel_bill', { p_bill: bill }),

  // Préstamos anotados a mano
  createDebt: (direction: 'lent' | 'borrowed', amountCents: number, concept: string | null) =>
    rpc<{ id: string; link_token: string }>('mm_create_debt', { p_direction: direction, p_amount_cents: amountCents, p_concept: concept }),
  debtPreview: (token: string) => rpc<DebtPreview | null>('mm_debt_preview', { p_token: token }),
  respondDebt: (token: string, accept: boolean) => rpc<{ id: string; status: string }>('mm_respond_debt', { p_token: token, p_accept: accept }),
  cancelDebt: (debt: string) => rpc<null>('mm_cancel_debt', { p_debt: debt }),

  // Pagos
  reportPayment: (debtIds: string[], method: PayMethodType) => rpc<string>('mm_report_payment', { p_debt_ids: debtIds, p_method: method }),
  confirmSettlement: (id: string) => rpc<null>('mm_confirm_settlement', { p_settlement: id }),
  rejectSettlement: (id: string) => rpc<null>('mm_reject_settlement', { p_settlement: id }),
  markReceived: (debtIds: string[], method: PayMethodType = 'cash') => rpc<string>('mm_mark_received', { p_debt_ids: debtIds, p_method: method }),
  forgive: (debtIds: string[]) => rpc<null>('mm_forgive', { p_debt_ids: debtIds }),
  remind: (other: string) => rpc<boolean>('mm_remind', { p_other: other }),

  // Pantallas
  home: () => rpc<HomeData>('mm_home'),
  ledger: () => rpc<Ledger>('mm_ledger'),
  notifications: (limit = 40) => rpc<AppNotification[]>('mm_list_notifications', { p_limit: limit }),
  markRead: (upTo?: number) => rpc<null>('mm_mark_read', upTo ? { p_up_to: upTo } : {}),
}

/** Métricas de producto: nunca rompen nada si fallan. */
export function track(name: string, props: Record<string, string | number | boolean | null> = {}) {
  if (!isConfigured) return
  void supabase.rpc('mm_track', { p_name: name, p_props: props }).then(
    () => undefined,
    () => undefined,
  )
}
