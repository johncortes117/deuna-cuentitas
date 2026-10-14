import { useState, useEffect, useCallback } from 'react';
import type { Debt } from './types';
import { getMyDebts, settleDebts as settleDebtsAPI, forgiveDebts as forgiveDebtsAPI, supabase } from './supabase';
import { getUserProfile, addToBalance } from './utils';

// "Te pagaron": lo escucha el aviso global para mostrarlo en cualquier pantalla.
export const PAYMENT_RECEIVED_EVENT = 'mitimiti:payment-received';
export interface PaymentReceivedDetail {
  debtorName: string; // si pagaron varias personas a la vez, va vacío
  amountCents: number;
}

const creditedKey = (debtId: string) => `mitimiti_credited_${debtId}`;
const markedPaidKey = (debtId: string) => `mitimiti_marked_paid_${debtId}`;

/** ¿El propio acreedor marcó esta deuda como pagada (efectivo, otro banco)? */
export function wasMarkedPaidByMe(debtId: string): boolean {
  return localStorage.getItem(markedPaidKey(debtId)) !== null;
}

/**
 * Cuando un amigo te paga una deuda desde SU teléfono, la plata tiene que
 * aparecer en TU saldo. Antes solo se descontaba del suyo: el que prestó
 * nunca la recibía.
 *
 * - Solo pagos posteriores a la primera vez que este teléfono vio sus deudas
 *   (para no sumar de golpe pagos viejos al actualizar la app).
 * - Una sola vez por deuda (marca en localStorage).
 * - Nunca las que el propio acreedor marcó como "Ya me pagó": esa plata se
 *   recibió fuera de Deuna.
 */
function creditIncomingPayments(debts: Debt[], userId: string) {
  const sinceKey = `mitimiti_credit_since_${userId}`;
  let since = localStorage.getItem(sinceKey);
  if (!since) {
    since = new Date().toISOString();
    localStorage.setItem(sinceKey, since);
  }
  const sinceMs = Date.parse(since);

  const fresh = debts.filter(
    d =>
      d.creditor_id === userId &&
      d.status === 'paid' &&
      d.paid_at !== null &&
      Date.parse(d.paid_at) > sinceMs &&
      localStorage.getItem(creditedKey(d.id)) === null,
  );
  if (fresh.length === 0) return;
  fresh.forEach(d => localStorage.setItem(creditedKey(d.id), '1'));

  const viaDeuna = fresh.filter(d => !wasMarkedPaidByMe(d.id));
  if (viaDeuna.length === 0) return;

  const amountCents = viaDeuna.reduce((acc, d) => acc + d.amount_cents, 0);
  addToBalance(amountCents);
  const debtors = new Set(viaDeuna.map(d => d.debtor_id));
  const detail: PaymentReceivedDetail = {
    debtorName: debtors.size === 1 ? viaDeuna[0].debtor_name : '',
    amountCents,
  };
  window.dispatchEvent(new CustomEvent(PAYMENT_RECEIVED_EVENT, { detail }));
}

export function useDebts() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const profile = getUserProfile();
  const userId = profile?.userId || '';

  // Sin "isLoading = true" al recargar: el esqueleto solo aparece la primera
  // vez; después los cambios llegan sin parpadeo.
  const loadDebts = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getMyDebts(userId);
      setDebts(data);
      creditIncomingPayments(data, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando deudas');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadDebts();

    if (userId) {
      // Nombre único por instancia: dos pantallas suscritas con el mismo
      // nombre de canal se pisan entre sí.
      const channel = supabase
        .channel(`debts-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'mitimiti_debts' },
          (payload) => {
            const newRecord = payload.new as Debt;
            if (newRecord && (newRecord.debtor_id === userId || newRecord.creditor_id === userId)) {
               void loadDebts();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId, loadDebts]);

  const run = useCallback(async (action: () => Promise<void>, fallback: string) => {
    try {
      setError(null);
      await action();
      await loadDebts();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
      return false;
    }
  }, [loadDebts]);

  // Pagar (como deudor) todas las deudas indicadas.
  const settleDebts = useCallback(
    (debtIds: string[]) => run(() => settleDebtsAPI(debtIds), 'Error pagando deuda'),
    [run],
  );

  const settleDebt = useCallback((debtId: string) => settleDebts([debtId]), [settleDebts]);

  // "Ya me pagó" (como acreedor): se marca ANTES de guardar para que el
  // aviso de "te pagaron" no le sume al saldo una plata que llegó en efectivo.
  const markDebtsPaid = useCallback(
    (debtIds: string[]) => {
      debtIds.forEach(id => localStorage.setItem(markedPaidKey(id), '1'));
      return run(() => settleDebtsAPI(debtIds), 'Error marcando la deuda');
    },
    [run],
  );

  const forgiveDebts = useCallback(
    (debtIds: string[]) => run(() => forgiveDebtsAPI(debtIds), 'Error perdonando deuda'),
    [run],
  );

  const forgiveDebt = useCallback((debtId: string) => forgiveDebts([debtId]), [forgiveDebts]);

  const debtsIOwe = debts.filter(d => d.debtor_id === userId && d.status === 'active');
  const debtsOwedToMe = debts.filter(d => d.creditor_id === userId && d.status === 'active');
  const history = debts.filter(d => d.status !== 'active');

  return {
    debtsIOwe,
    debtsOwedToMe,
    history,
    isLoading: userId ? isLoading : false,
    error,
    settleDebt,
    settleDebts,
    markDebtsPaid,
    forgiveDebt,
    forgiveDebts,
    refresh: loadDebts
  };
}
