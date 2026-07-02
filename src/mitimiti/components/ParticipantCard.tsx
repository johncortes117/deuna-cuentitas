// ─── ParticipantCard: Card individual con avatar, monto, estado ──
import { getAvatarColor, getInitials, formatMoney } from '../utils';
import type { Participant } from '../types';

interface ParticipantCardProps {
  participant: Participant;
  isMe: boolean;
  isRoomHost: boolean; // si este participant es el host de la sala
  index: number;
}

export default function ParticipantCard({
  participant,
  isMe,
  isRoomHost,
  index,
}: ParticipantCardProps) {
  const color = getAvatarColor(participant.display_name);
  const initials = getInitials(participant.display_name);

  const statusConfig = {
    pending: { icon: '⏳', label: 'Pendiente', textColor: '#9ca3af', bg: '#F4F4F6' },
    confirmed: { icon: '✅', label: 'Listo', textColor: '#3B6D11', bg: '#EAF3DE' },
    declined: { icon: '❌', label: 'Rechazó', textColor: '#A32D2D', bg: '#FCEBEB' },
  };

  const status = statusConfig[participant.confirmation_status];

  return (
    <div
      className="mitimiti-fade-in-up flex items-center gap-3 py-3 px-1"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: color }}
      >
        <span className="text-white text-[13px] font-bold">{initials}</span>
      </div>

      {/* Nombre + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] font-semibold text-[#1a1a1a] truncate">
            {participant.display_name}
          </span>
          {isMe && (
            <span className="text-[10px] font-bold text-[#4C1D80] bg-[#EEEDFE] px-1.5 py-0.5 rounded">
              Tú
            </span>
          )}
          {isRoomHost && (
            <span className="text-[10px] font-bold text-white bg-[#4C1D80] px-1.5 py-0.5 rounded">
              Host
            </span>
          )}
        </div>

        {/* Status chip */}
        {participant.amount_cents !== null && (
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-full inline-block mt-0.5"
            style={{ backgroundColor: status.bg, color: status.textColor }}
          >
            {status.icon} {status.label}
          </span>
        )}
      </div>

      {/* Monto */}
      <span className="text-[16px] font-bold text-[#1a1a1a] shrink-0">
        {participant.amount_cents !== null
          ? formatMoney(participant.amount_cents)
          : '—'}
      </span>
    </div>
  );
}
