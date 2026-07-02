// ─── SuccessView: Pago exitoso con confetti ──────────────────
import { useMemo } from 'react';
import type { Room, Participant } from '../types';
import { formatMoney } from '../utils';
import ParticipantCard from './ParticipantCard';

interface SuccessViewProps {
  room: Room;
  participants: Participant[];
  myUserId: string;
  onDone: () => void;
}

// Genera partículas de confetti con posiciones y colores aleatorios
function generateConfetti(count: number) {
  const colors = ['#4C1D80', '#2FD9A9', '#fbbf24', '#ef4444', '#3b82f6', '#ec4899'];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    color: colors[Math.floor(Math.random() * colors.length)],
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 2,
    size: 6 + Math.random() * 6,
  }));
}

export default function SuccessView({ room, participants, myUserId, onDone }: SuccessViewProps) {
  const confetti = useMemo(() => generateConfetti(30), []);
  const myParticipant = participants.find(p => p.user_id === myUserId);

  return (
    <div className="flex flex-col flex-1 relative overflow-hidden">
      {/* Confetti */}
      <div className="mitimiti-confetti">
        {confetti.map(c => (
          <div
            key={c.id}
            className="mitimiti-confetti-particle"
            style={{
              left: `${c.left}%`,
              backgroundColor: c.color,
              width: `${c.size}px`,
              height: `${c.size}px`,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Contenido */}
      <div className="flex flex-col items-center flex-1 px-6 pt-8 pb-4 overflow-y-auto">
        {/* Check animado */}
        <div className="mitimiti-check mb-4">
          <div className="w-20 h-20 bg-[#2FD9A9] rounded-full flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <h2 className="text-[22px] font-bold text-[#1a1a1a] mb-1">
          ¡Pago exitoso!
        </h2>
        <p className="text-[14px] text-gray-400 mb-4">
          {room.commerce_name}
        </p>

        {/* Monto total */}
        <div className="bg-[#F8F8FA] rounded-2xl p-4 w-full mb-4 text-center border border-gray-100">
          <p className="text-[13px] text-gray-400 mb-1">Total pagado entre {participants.length}</p>
          <p className="text-[32px] font-bold text-[#1a1a1a] leading-none">
            {formatMoney(room.total_cents)}
          </p>
          {myParticipant && (
            <p className="text-[15px] text-[#4C1D80] font-semibold mt-2">
              Tu parte: {formatMoney(myParticipant.amount_cents || 0)}
            </p>
          )}
        </div>

        {/* Lista de participantes */}
        <div className="w-full">
          <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-2">Resumen</h3>
          <div className="divide-y divide-gray-50">
            {participants.map((p, i) => (
              <ParticipantCard
                key={p.id}
                participant={p}
                isMe={p.user_id === myUserId}
                isRoomHost={p.role === 'host'}
                index={i}
              />
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-4 shrink-0">
        <button
          onClick={onDone}
          className="w-full py-4 rounded-[14px] bg-[#4C1D80] text-white text-[16px] font-bold active:scale-[0.98] transition-transform"
        >
          Listo
        </button>
      </div>
    </div>
  );
}
