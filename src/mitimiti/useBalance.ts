import { useState, useCallback, useEffect } from 'react';
import { getUserProfile, saveUserProfile, BALANCE_CHANGED_EVENT } from './utils';

export function useBalance() {
  // Se lee de una vez al montar: antes arrancaba en $0 hasta que corría un
  // efecto, y un toque rápido podía ver "no te alcanza" con plata de sobra.
  const [balance, setBalance] = useState<number>(() => getUserProfile()?.balanceCents ?? 0);

  // Cualquier cambio de saldo en otra parte de la app (débito de la sala, un
  // amigo que te pagó, una recarga) se refleja aquí al instante.
  useEffect(() => {
    const sync = () => setBalance(getUserProfile()?.balanceCents ?? 0);
    window.addEventListener(BALANCE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(BALANCE_CHANGED_EVENT, sync);
  }, []);

  const deduct = useCallback((amount: number) => {
    const profile = getUserProfile();
    if (profile) {
      profile.balanceCents = Math.max(0, profile.balanceCents - amount);
      saveUserProfile(profile);
      setBalance(profile.balanceCents);
    }
  }, []);

  const add = useCallback((amount: number) => {
    const profile = getUserProfile();
    if (profile) {
      profile.balanceCents += amount;
      saveUserProfile(profile);
      setBalance(profile.balanceCents);
    }
  }, []);

  const hasSufficientFunds = useCallback((amount: number) => {
    return balance >= amount;
  }, [balance]);

  return {
    balance,
    deduct,
    add,
    hasSufficientFunds
  };
}
