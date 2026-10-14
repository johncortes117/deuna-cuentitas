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
  expireRoom as expireRoomAPI,
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
  // Devuelve los montos asignados (o null si falló; el error queda en `error`).
  lockRoom: (splitMode?: 'equal' | 'custom', customAmounts?: {userId: string, amountCents: number}[]) => Promise<{ userId: string; amountCents: number }[] | null>;
  // Devuelve true si quedó confirmado.
  confirmPayment: (expectedAmountCents?: number) => Promise<boolean>;
  executePayment: (simulateFailure?: boolean) => Promise<void>;
  leaveRoom: () => Promise<void>;
  cancelRoom: () => Promise<void>;
  expireRoom: () => Promise<void>;
  requestLoan: (deficitCents: number) => Promise<void>;
  lendMoney: (borrowerId: string, borrowerName: string, amountCents: number) => Promise<void>;
  clearError: () => void;
}

/**
 * Conserva la referencia anterior si el dato entrante es idéntico.
 *
 * El respaldo re-consulta cada pocos segundos y devolvía SIEMPRE un array
 * nuevo, así que la sala se re-renderizaba de balde aunque nada hubiera
 * cambiado. Eso además re-ejecutaba el cálculo por persona, que reparte el
 * centavo sobrante al azar: los montos estimados se barajaban solos en
 * pantalla cada tick.
 */
function keepIfSame<T>(prev: T, next: T): T {
  return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
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

  // Debitar saldo cuando la sala se completa.
  // El débito real considera los préstamos de la sala: si te prestaron,
  // pagas tu parte MENOS lo prestado (esa parte la cubre el prestamista y
  // queda como deuda); si prestaste, pagas tu parte MÁS lo que prestaste.
  useEffect(() => {
    if (room?.status === 'completed' && myParticipant) {
      const storageKey = `debited_room_${room.id}`;
      if (!localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, 'true');
        const currentProfile = getUserProfile();
        if (currentProfile) {
          const borrowed = debts
            .filter(d => d.debtor_id === userId)
            .reduce((acc, d) => acc + d.amount_cents, 0);
          const lent = debts
            .filter(d => d.creditor_id === userId)
            .reduce((acc, d) => acc + d.amount_cents, 0);
          const netDebit = Math.max(0, (myParticipant.amount_cents || 0) - borrowed + lent);
          saveUserProfile({
            ...currentProfile,
            balanceCents: Math.max(0, currentProfile.balanceCents - netDebit),
          });
        }
      }
    }
  }, [room?.status, myParticipant, room?.id, debts, userId]);

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
        const unsub = subscribeToRoom(roomId!, {
          onRoomChange: (updatedRoom) => {
            if (mounted) setRoom(prev => keepIfSame(prev, updatedRoom));
          },
          onParticipantsChange: (updatedParticipants) => {
            if (mounted) setParticipants(prev => keepIfSame(prev, updatedParticipants));
          },
          onDebtsChange: (updatedDebts) => {
            if (mounted) setDebts(prev => keepIfSame(prev, updatedDebts));
          }
        });
        // Si nos desmontamos mientras cargaba, cerrar el canal de inmediato
        // (antes quedaba suscrito para siempre — fuga de canales realtime).
        if (!mounted) {
          unsub();
        } else {
          unsubRef.current = unsub;
        }
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

  // Polling de respaldo: si algún evento realtime se pierde (canal caído,
  // reconexión, etc.), esto re-sincroniza sala y participantes.
  // Garantiza que salidas/entradas/cambios de estado SIEMPRE se reflejen.
  //
  // En 'waiting' es cuando la gente va entrando y el host está mirando el QR
  // esperando verlos aparecer. Si realtime falla, este respaldo es lo único
  // que queda, y 5s de retraso se sienten como que la app no responde: en esa
  // fase lo apretamos.
  const pollMs = room?.status === 'waiting' ? 2000 : 5000;

  useEffect(() => {
    if (!roomId) return;
    let inFlight = false;
    const interval = setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const [roomData, participantsData] = await Promise.all([
          getRoom(roomId),
          getParticipants(roomId),
        ]);
        if (roomData) setRoom(prev => keepIfSame(prev, roomData));
        setParticipants(prev => keepIfSame(prev, participantsData));
      } catch {
        // Sin conexión momentánea: se reintenta en el próximo tick.
      } finally {
        inFlight = false;
      }
    }, pollMs);
    return () => clearInterval(interval);
  }, [roomId, pollMs]);

  const lockRoom = useCallback(async (splitMode: 'equal' | 'custom' = 'equal', customAmounts?: {userId: string, amountCents: number}[]) => {
    if (!roomId || !userId) return null;
    try {
      setError(null);
      return await lockRoomAPI(roomId, userId, splitMode, customAmounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error dividiendo la cuenta');
      return null;
    }
  }, [roomId, userId]);

  const confirmPayment = useCallback(async (expectedAmountCents?: number) => {
    if (!roomId || !userId) return false;
    try {
      setError(null);
      await confirmPaymentAPI(roomId, userId, expectedAmountCents);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error confirmando');
      return false;
    }
  }, [roomId, userId]);

  // Cualquiera en la sala puede cerrarla al vencer (antes solo el host, y
  // solo si estaba mirando la pantalla en 'waiting').
  const expireRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      await expireRoomAPI(roomId);
    } catch {
      // Si falla, la próxima lectura de la sala la vuelve a cerrar.
    }
  }, [roomId]);

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
    expireRoom,
    requestLoan,
    lendMoney,
    clearError,
  };
}
