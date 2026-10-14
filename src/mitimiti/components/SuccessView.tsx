// ─── SuccessView: Pago exitoso con confetti ──────────────────
import { useMemo } from 'react';
import type { Room, Participant, Debt } from '../types';
import { formatMoney, formatDuration, roomEmoji } from '../utils';
import { openWhatsApp, successMessage } from '../share';
import { trackEvent } from '../analytics';
import ParticipantCard from './ParticipantCard';

interface SuccessViewProps {
  room: Room;
  participants: Participant[];
  myUserId: string;
  // Préstamos hechos en esta sala (para decir exactamente quién le debe a quién).
  roomDebts: Debt[];
  onDone: () => void;
  onOpenDebts: (tab: 'owe' | 'owed') => void;
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

export default function SuccessView({ room, participants, myUserId, roomDebts, onDone, onOpenDebts }: SuccessViewProps) {
  const confetti = useMemo(() => generateConfetti(30), []);
  const myParticipant = participants.find(p => p.user_id === myUserId);
  const isHost = room.host_id === myUserId;

  // "Dividida en 1 min 12 s": el momento wow es lo rápido que fue.
  const duration = room.paid_at
    ? formatDuration(Date.parse(room.paid_at) - Date.parse(room.created_at))
    : null;

  const liveDebts = roomDebts.filter(d => d.status === 'pending' || d.status === 'active');
  const iBorrowed = liveDebts.filter(d => d.debtor_id === myUserId);
  const iLent = liveDebts.filter(d => d.creditor_id === myUserId);

  const share = () => {
    trackEvent('SUCCESS_SHARED', room.id, myUserId);
    openWhatsApp(successMessage(room.commerce_name, room.total_cents, participants.length, duration));
  };

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
      <div className="flex flex-col items-center flex-1 px-6 pt-14 pb-4 overflow-y-auto">
        {/* Check animado */}
        <div className="mitimiti-check mb-4">
          <div className="w-20 h-20 bg-[#2FD9A9] rounded-full flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <h2 className="text-[22px] font-bold text-[#1a1a1a] mb-1">¡Cuenta pagada!</h2>
        <p className="text-[14px] text-gray-500 mb-3">
          {roomEmoji(room.commerce_name)} {room.commerce_name}
        </p>
        {duration && (
          <p className="text-[13px] font-semibold text-[#4C1D80] bg-[#F3EDFB] px-3 py-1 rounded-full mb-4">
            ⚡ Dividida en {duration}
          </p>
        )}

        {/* Monto total */}
        <div className="bg-[#F8F8FA] rounded-2xl p-4 w-full mb-3 text-center border border-gray-100">
          <p className="text-[13px] text-gray-500 mb-1">
            {isHost ? `Pagaste al local entre ${participants.length}` : `Total pagado entre ${participants.length}`}
          </p>
          <p className="text-[32px] font-bold text-[#1a1a1a] leading-none tabular-nums">
            {formatMoney(room.total_cents)}
          </p>
          {myParticipant && (
            <p className="text-[15px] text-[#4C1D80] font-semibold mt-2">
              Tu parte: {formatMoney(myParticipant.amount_cents || 0)}
            </p>
          )}
        </div>

        {/* Quién le debe a quién, solo si pasó en esta sala */}
        {iBorrowed.map(d => (
          <DebtNote
            key={d.id}
            tone="owe"
            title={`Le debes ${formatMoney(d.amount_cents)} a ${d.creditor_name}`}
            subtitle="Te prestó para completar tu parte. Págale cuando puedas."
            action="Ver"
            onAction={() => onOpenDebts('owe')}
          />
        ))}
        {iLent.map(d => (
          <DebtNote
            key={d.id}
            tone="owed"
            title={`${d.debtor_name} te debe ${formatMoney(d.amount_cents)}`}
            subtitle="Quedó anotado. Te avisaremos cuando te pague."
            action="Ver"
            onAction={() => onOpenDebts('owed')}
          />
        ))}

        {/* Lista de participantes */}
        <div className="w-full mt-2">
          <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-1">Resumen</h3>
          <div className="divide-y divide-gray-50">
            {participants.map((p, i) => (
              <ParticipantCard
                key={p.id}
                participant={p}
                isMe={p.user_id === myUserId}
                isRoomHost={p.role === 'host'}
                index={i}
                hasLoan={liveDebts.some(d => d.debtor_id === p.user_id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 shrink-0">
        <button
          onClick={onDone}
          className="w-full py-4 rounded-[14px] bg-[#4C1D80] text-white text-[16px] font-bold active:scale-[0.98] transition-transform"
        >
          Listo
        </button>
        <button
          onClick={share}
          className="w-full py-3 mt-1 text-[#4C1D80] text-[14px] font-bold flex items-center justify-center gap-2 active:opacity-70"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          </svg>
          Compartir con el grupo
        </button>
      </div>
    </div>
  );
}

function DebtNote({
  tone,
  title,
  subtitle,
  action,
  onAction,
}: {
  tone: 'owe' | 'owed';
  title: string;
  subtitle: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div
      className={`w-full rounded-2xl p-3.5 mb-3 flex items-center gap-3 border ${
        tone === 'owe' ? 'bg-orange-50 border-orange-100' : 'bg-[#EAF3DE] border-[#3B6D11]/15'
      }`}
    >
      <span className="text-[20px]" aria-hidden="true">{tone === 'owe' ? '🧾' : '💰'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-[#1a1a1a]">{title}</p>
        <p className="text-[12px] text-gray-600">{subtitle}</p>
      </div>
      <button
        onClick={onAction}
        className={`px-3.5 py-1.5 rounded-full text-[13px] font-bold shrink-0 ${
          tone === 'owe' ? 'bg-white text-orange-700' : 'bg-white text-[#3B6D11]'
        }`}
      >
        {action}
      </button>
    </div>
  );
}
