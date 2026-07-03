import { useState, useCallback, useEffect } from 'react';
import { getUserProfile, saveUserProfile } from './utils';

export function useBalance() {
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    const profile = getUserProfile();
    if (profile) {
      setBalance(profile.balanceCents);
    }
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
