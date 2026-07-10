// ─── useRoom: Hook de estado real-time de una sala MitiMiti ──
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Room, Participant, Debt } from './types';
import { supabase } from './supabase';
import {
  getRoom,
  getParticipants,
  subscribeToRoom,
  lockRoom as lockRoomAPI,
  confirmPayment as confirmPaymentAPI,
  executePayment as executePaymentAPI,
  leaveRoom as leaveRoomAPI,
  cancelRoom as cancelRoomAPI,
  requestLoan as requestLoanAPI,
  lendMoney as lendMoneyAPI,
} from './supabase';
import { dividirMonto, getUserProfile, saveUserProfile } from './utils';

export interface UseRoomReturn {
  room: Room | null;
  participants: Participant[];
  myParticipant: Participant | null;
  isHost: boolean;
  isLoading: boolean;
  error: string | null;
  amountPerPerson: number; // cálculo live en centavos
  debts: Debt[];

  // Acciones
  lockRoom: (splitMode?: 'equal' | 'custom', customAmounts?: {userId: string, amountCents: number}[]) => Promise<void>;
  confirmPayment: () => Promise<void>;
  executePayment: (simulateFailure?: boolean) => Promise<void>;
  leaveRoom: () => Promise<void>;
  cancelRoom: () => Promise<void>;
  requestLoan: (deficitCents: number) => Promise<void>;
  lendMoney: (borrowerId: string, borrowerName: string, amountCents: number) => Promise<void>;
  clearError: () => void;
}

export function useRoom(roomId: string | null): UseRoomReturn {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const profile = getUserProfile();
  const userId = profile?.userId || '';

  const myParticipant = participants.find(p => p.user_id === userId) || null;
  const isHost = room?.host_id === userId;

  // Cálculo live del monto por persona (antes de lock)
  const amountPerPerson = room && participants.length > 0
    ? dividirMonto(room.total_cents + room.tip_cents, participants.length)[0]
    : 0;

  // Debitar saldo cuando la sala se completa
  useEffect(() => {
    if (room?.status === 'completed' && myParticipant) {
      const storageKey = `debited_room_${room.id}`;
      if (!localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, 'true');
        const currentProfile = getUserProfile();
        if (currentProfile) {
          saveUserProfile({
            ...currentProfile,
            balanceCents: currentProfile.balanceCents - (myParticipant.amount_cents || 0)
          });
        }
      }
    }
  }, [room?.status, myParticipant, room?.id]);

  // Cargar datos iniciales + suscribirse a Realtime
  useEffect(() => {
    if (!roomId) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function load() {
      try {
        const [roomData, participantsData, debtsData] = await Promise.all([
          getRoom(roomId!),
          getParticipants(roomId!),
          supabase.from('mitimiti_debts').select('*').eq('room_id', roomId!)
        ]);

        if (!mounted) return;

        if (!roomData) {
          setError('Sala no encontrada');
          setIsLoading(false);
          return;
        }

        setRoom(roomData);
        setParticipants(participantsData);
        if (debtsData.data) setDebts(debtsData.data as Debt[]);
        setIsLoading(false);

        // Suscribirse a cambios en tiempo real
        unsubRef.current = subscribeToRoom(roomId!, {
          onRoomChange: (updatedRoom) => {
            if (mounted) setRoom(updatedRoom);
          },
          onParticipantsChange: (updatedParticipants) => {
            if (mounted) setParticipants(updatedParticipants);
          },
          onDebtsChange: (updatedDebts) => {
            if (mounted) setDebts(updatedDebts);
          }
        });
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Error desconocido');
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [roomId]);

  const lockRoom = useCallback(async (splitMode: 'equal' | 'custom' = 'equal', customAmounts?: {userId: string, amountCents: number}[]) => {
    if (!roomId || !userId) return;
    try {
      setError(null);
      await lockRoomAPI(roomId, userId, splitMode, customAmounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cerrando sala');
    }
  }, [roomId, userId]);

  const confirmPayment = useCallback(async () => {
    if (!roomId || !userId) return;
    try {
      setError(null);
      await confirmPaymentAPI(roomId, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error confirmando');
    }
  }, [roomId, userId]);

  const executePayment = useCallback(async (simulateFailure = false) => {
    if (!roomId || !userId) return;
    try {
      setError(null);
      await executePaymentAPI(roomId, userId, simulateFailure);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error ejecutando pago');
    }
  }, [roomId, userId]);

  const leaveRoom = useCallback(async () => {
    if (!roomId || !userId) return;
    try {
      setError(null);
      await leaveRoomAPI(roomId, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saliendo');
    }
  }, [roomId, userId]);

  const cancelRoom = useCallback(async () => {
    if (!roomId || !userId) return;
    try {
      setError(null);
      await cancelRoomAPI(roomId, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cancelando');
    }
  }, [roomId, userId]);

  const requestLoan = useCallback(async (deficitCents: number) => {
    if (!roomId || !userId) return;
    try {
      setError(null);
      await requestLoanAPI(roomId, userId, deficitCents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error solicitando préstamo');
    }
  }, [roomId, userId]);

  const lendMoney = useCallback(async (borrowerId: string, borrowerName: string, amountCents: number) => {
    if (!roomId || !userId) return;
    try {
      setError(null);
      await lendMoneyAPI(roomId, userId, profile?.displayName || 'Desconocido', borrowerId, borrowerName, amountCents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error prestando dinero');
    }
  }, [roomId, userId, profile]);

  const clearError = useCallback(() => setError(null), []);

  return {
    room,
    participants,
    myParticipant,
    isHost,
    isLoading,
    error,
    amountPerPerson,
    debts,
    lockRoom,
    confirmPayment,
    executePayment,
    leaveRoom,
    cancelRoom,
    requestLoan,
    lendMoney,
    clearError,
  };
}
