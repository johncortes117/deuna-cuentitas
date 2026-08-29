// ─── JoinRoomView: Entrada directa a una sala MitiMiti ───────
import { useState, useEffect, useRef } from 'react';
import type { Room } from '../types';
import { getRoomByToken, getParticipants, joinRoom } from '../supabase';
import { formatMoney, getUserProfile } from '../utils';

interface JoinRoomViewProps {
  inviteToken: string;
  onJoined: (roomId: string) => void;
  onBack: () => void;
}

export default function JoinRoomView({ inviteToken, onJoined, onBack }: JoinRoomViewProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Perfil estable: getUserProfile() crea un objeto NUEVO en cada render;
  // tenerlo como dependencia del efecto causaba un loop infinito de fetches.
  const [profile] = useState(() => getUserProfile());
  const onJoinedRef = useRef(onJoined);
  useEffect(() => {
    onJoinedRef.current = onJoined;
  }, [onJoined]);

  // Escanear el QR YA es la aceptación: entramos solos, sin pedir un tap más.
  // El ref evita un doble POST si el efecto se re-ejecuta (StrictMode en dev).
  const isEntering = useRef(false);

  useEffect(() => {
    let roomId: string | null = null;

    async function enterRoom() {
      if (isEntering.current) return;
      isEntering.current = true;

      try {
        const roomData = await getRoomByToken(inviteToken);
        if (!roomData) {
          setError('Sala no encontrada');
          return;
        }

        if (roomData.status !== 'waiting') {
          setError('Esta sala ya está cerrada');
          return;
        }

        if (!profile) {
          setError('No encontramos tu perfil');
          return;
        }

        // Mostramos los datos de la sala mientras entramos: el usuario ve a
        // qué se une sin que eso lo detenga con una confirmación.
        roomId = roomData.id;
        setRoom(roomData);

        const parts = await getParticipants(roomData.id);
        if (parts.some(p => p.user_id === profile.userId)) {
          onJoinedRef.current(roomData.id);
          return;
        }

        await joinRoom(inviteToken, profile.userId, profile.displayName);
        onJoinedRef.current(roomData.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al entrar a la sala';

        // Carrera con otra pestaña o con un reintento de red: ya estamos
        // dentro, así que esto no es un error para el usuario.
        if (message === 'Ya estás en esta sala' && roomId) {
          onJoinedRef.current(roomId);
          return;
        }

        setError(message);
      } finally {
        isEntering.current = false;
      }
    }

    enterRoom();
  }, [inviteToken, profile, attempt]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6">
        <div className="w-16 h-16 bg-[#FCEBEB] rounded-full flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-[16px] font-bold text-[#1a1a1a] mb-2 text-center">{error}</p>
        <div className="flex gap-3 mt-4">
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-[14px] bg-gray-100 text-[#1a1a1a] text-[14px] font-bold"
          >
            Volver
          </button>
          <button
            onClick={() => {
              setError(null);
              setAttempt(a => a + 1);
            }}
            className="px-6 py-3 rounded-[14px] bg-[#4C1D80] text-white text-[14px] font-bold active:scale-[0.98]"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Header: salida disponible mientras entramos */}
      <div className="flex items-center px-5 pt-14 pb-3 shrink-0">
        <button onClick={onBack} className="mr-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-[17px] font-bold text-[#1a1a1a]">MitiMiti</h1>
      </div>

      {/* Transición: entrando a la sala */}
      <div className="flex flex-col items-center flex-1 px-6 pt-10">
        <div className="mitimiti-spin w-10 h-10 border-3 border-gray-200 border-t-[#4C1D80] rounded-full mb-6" />

        <h2 className="text-[20px] font-bold text-[#1a1a1a] mb-1 text-center">
          {room ? `Entrando a la sala de ${room.host_name}` : 'Entrando a la sala'}
        </h2>
        <p className="text-[14px] text-gray-400 text-center">
          Pago en grupo
        </p>

        {room && (
          <div className="bg-[#F8F8FA] rounded-2xl p-5 w-full mt-6 border border-gray-100">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[13px] text-gray-400">Sala</span>
                <span className="text-[14px] font-semibold text-[#1a1a1a]">
                  {room.commerce_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-gray-400">Total</span>
                <span className="text-[14px] font-bold text-[#1a1a1a]">
                  {formatMoney(room.total_cents)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
