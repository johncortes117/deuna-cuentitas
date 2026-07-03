import { useState, useEffect, useCallback } from 'react';
import type { Debt } from './types';
import { getMyDebts, settleDebt as settleDebtAPI, forgiveDebt as forgiveDebtAPI, supabase } from './supabase';
import { getUserProfile } from './utils';

export function useDebts() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const profile = getUserProfile();
  const userId = profile?.userId || '';

  const loadDebts = useCallback(async () => {
    if (!userId) return;
    try {
      setIsLoading(true);
      const data = await getMyDebts(userId);
      setDebts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando deudas');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDebts();

    if (userId) {
      // Sub to changes
      const channel = supabase
        .channel(`debts-${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'mitimiti_debts' },
          (payload) => {
            const newRecord = payload.new as Debt;
            if (newRecord && (newRecord.debtor_id === userId || newRecord.creditor_id === userId)) {
               loadDebts();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId, loadDebts]);

  const settleDebt = useCallback(async (debtId: string) => {
    try {
      setError(null);
      await settleDebtAPI(debtId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error pagando deuda');
    }
  }, []);

  const forgiveDebt = useCallback(async (debtId: string) => {
    try {
      setError(null);
      await forgiveDebtAPI(debtId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error perdonando deuda');
    }
  }, []);

  const debtsIOwe = debts.filter(d => d.debtor_id === userId && d.status === 'active');
  const debtsOwedToMe = debts.filter(d => d.creditor_id === userId && d.status === 'active');
  const history = debts.filter(d => d.status !== 'active');

  return {
    debtsIOwe,
    debtsOwedToMe,
    history,
    isLoading,
    error,
    settleDebt,
    forgiveDebt,
    refresh: loadDebts
  };
}
