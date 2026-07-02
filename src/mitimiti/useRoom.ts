// ─── useRoom: Hook de estado real-time de una sala MitiMiti ──
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Room, Participant } from './types';
import {
  getRoom,
  getParticipants,
  subscribeToRoom,
  lockRoom as lockRoomAPI,
  confirmPayment as confirmPaymentAPI,
  executePayment as executePaymentAPI,
  leaveRoom as leaveRoomAPI,
  cancelRoom as cancelRoomAPI,
} from './supabase';
import { dividirMonto, getUserProfile } from './utils';

export interface UseRoomReturn {
  room: Room | null;
  participants: Participant[];
  myParticipant: Participant | null;
  isHost: boolean;
  isLoading: boolean;
  error: string | null;
  amountPerPerson: number; // cálculo live en centavos

  // Acciones
  lockRoom: () => Promise<void>;
  confirmPayment: () => Promise<void>;
  executePayment: (simulateFailure?: boolean) => Promise<void>;
  leaveRoom: () => Promise<void>;
  cancelRoom: () => Promise<void>;
  clearError: () => void;
}

export function useRoom(roomId: string | null): UseRoomReturn {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
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

  // Cargar datos iniciales + suscribirse a Realtime
  useEffect(() => {
    if (!roomId) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function load() {
      try {
        const [roomData, participantsData] = await Promise.all([
          getRoom(roomId!),
          getParticipants(roomId!),
        ]);

        if (!mounted) return;

        if (!roomData) {
          setError('Sala no encontrada');
          setIsLoading(false);
          return;
        }

        setRoom(roomData);
        setParticipants(participantsData);
        setIsLoading(false);

        // Suscribirse a cambios en tiempo real
        unsubRef.current = subscribeToRoom(roomId!, {
          onRoomChange: (updatedRoom) => {
            if (mounted) setRoom(updatedRoom);
          },
          onParticipantsChange: (updatedParticipants) => {
            if (mounted) setParticipants(updatedParticipants);
          },
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

  const lockRoom = useCallback(async () => {
    if (!roomId || !userId) return;
    try {
      setError(null);
      await lockRoomAPI(roomId, userId);
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

  const clearError = useCallback(() => setError(null), []);

  return {
    room,
    participants,
    myParticipant,
    isHost,
    isLoading,
    error,
    amountPerPerson,
    lockRoom,
    confirmPayment,
    executePayment,
    leaveRoom,
    cancelRoom,
    clearError,
  };
}
