// ─── JoinRoomView: Unirse a una sala MitiMiti ────────────────
import { useState, useEffect } from 'react';
import type { Room, Participant } from '../types';
import { getRoomByToken, getParticipants, joinRoom } from '../supabase';
import { formatMoney, dividirMonto, getUserProfile } from '../utils';

interface JoinRoomViewProps {
  inviteToken: string;
  onJoined: (roomId: string) => void;
  onBack: () => void;
}

export default function JoinRoomView({ inviteToken, onJoined, onBack }: JoinRoomViewProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = getUserProfile();

  useEffect(() => {
    async function load() {
      try {
        const roomData = await getRoomByToken(inviteToken);
        if (!roomData) {
          setError('Sala no encontrada');
          setIsLoading(false);
          return;
        }

        if (roomData.status !== 'waiting') {
          setError('Esta sala ya está cerrada');
          setIsLoading(false);
          return;
        }

        const parts = await getParticipants(roomData.id);

        // Si ya estoy en la sala, ir directo a la room view
        if (profile && parts.some(p => p.user_id === profile.userId)) {
          onJoined(roomData.id);
          return;
        }

        setRoom(roomData);
        setParticipants(parts);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando sala');
        setIsLoading(false);
      }
    }

    load();
  }, [inviteToken, profile, onJoined]);

  const handleJoin = async () => {
    if (!profile || !room) return;

    setIsJoining(true);
    setError(null);

    try {
      await joinRoom(inviteToken, profile.userId, profile.displayName);
      onJoined(room.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al unirse');
      setIsJoining(false);
    }
  };



  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1">
        <div className="mitimiti-spin w-8 h-8 border-3 border-gray-200 border-t-[#4C1D80] rounded-full" />
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6">
        <div className="w-16 h-16 bg-[#FCEBEB] rounded-full flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-[16px] font-bold text-[#1a1a1a] mb-2">{error}</p>
        <button
          onClick={onBack}
          className="mt-4 px-6 py-3 rounded-[14px] bg-gray-100 text-[#1a1a1a] text-[14px] font-bold"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="flex items-center px-5 pt-14 pb-3 shrink-0">
        <button onClick={onBack} className="mr-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-[17px] font-bold text-[#1a1a1a]">MitiMiti</h1>
      </div>

      {/* Contenido */}
      <div className="flex flex-col items-center flex-1 px-6 pt-6">
        {/* Emoji / icono */}
        <div className="w-16 h-16 bg-[#EEEDFE] rounded-full flex items-center justify-center mb-5">
          <span className="text-3xl">🤝</span>
        </div>

        <h2 className="text-[20px] font-bold text-[#1a1a1a] mb-1 text-center">
          Te invitan a pagar en grupo
        </h2>

        {/* Datos de la sala */}
        <div className="bg-[#F8F8FA] rounded-2xl p-5 w-full mt-5 border border-gray-100">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-[13px] text-gray-400">Sala</span>
              <span className="text-[14px] font-semibold text-[#1a1a1a]">
                {room?.commerce_name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[13px] text-gray-400">Host</span>
              <span className="text-[14px] font-semibold text-[#1a1a1a]">
                {room?.host_name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[13px] text-gray-400">Total</span>
              <span className="text-[14px] font-bold text-[#1a1a1a]">
                {room && formatMoney(room.total_cents)}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-[13px] mt-3">{error}</p>
        )}
      </div>

      {/* CTA */}
      <div className="px-6 pb-4 shrink-0">
        <button
          onClick={handleJoin}
          disabled={isJoining || !profile}
          className={`w-full py-4 rounded-[14px] text-[16px] font-bold transition-all ${
            isJoining
              ? 'bg-gray-200 text-gray-400'
              : 'bg-[#4C1D80] text-white active:scale-[0.98]'
          }`}
        >
          {isJoining ? 'Uniéndome...' : 'Unirme'}
        </button>
      </div>
    </div>
  );
}
