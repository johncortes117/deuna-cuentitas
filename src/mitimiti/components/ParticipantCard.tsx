// ─── ParticipantCard: Card individual con avatar, monto, estado ──
import { formatMoney } from '../utils';
import type { Participant } from '../types';
import Avatar from './Avatar';

interface ParticipantCardProps {
  participant: Participant;
  isMe: boolean;
  isRoomHost: boolean; // si este participant es el host de la sala
  index: number;
  hasLoan?: boolean;
  // Mientras la cuenta no se divide nadie puede aceptar nada: mostrar
  // "Pendiente" a todos solo generaba la duda de "¿pendiente de qué?".
  showStatus?: boolean;
  // Monto aproximado (antes de dividir): se muestra con "~" y más suave.
  estimated?: boolean;
}

export default function ParticipantCard({
  participant,
  isMe,
  isRoomHost,
  index,
  hasLoan,
  showStatus = true,
  estimated = false,
}: ParticipantCardProps) {
  const nothingToPay = participant.amount_cents === 0 && participant.confirmation_status === 'confirmed';

  const statusConfig = {
    pending: { icon: '⏳', label: 'Por aceptar', textColor: '#6B7280', bg: '#F4F4F6' },
    confirmed: nothingToPay
      ? { icon: '🎁', label: 'No paga', textColor: '#4C1D80', bg: '#EEEDFE' }
      : { icon: '✅', label: 'Aceptó', textColor: '#3B6D11', bg: '#EAF3DE' },
    declined: { icon: '❌', label: 'Rechazó', textColor: '#A32D2D', bg: '#FCEBEB' },
    requesting_loan: { icon: '🙏', label: 'Necesita ayuda', textColor: '#C2410C', bg: '#FFEDD5' },
  };

  const status = statusConfig[participant.confirmation_status];

  return (
    <div
      className="mitimiti-fade-in-up flex items-center gap-3 py-3 px-1"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}
    >
      <Avatar name={participant.display_name} size={40} />

      {/* Nombre + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[15px] font-semibold text-[#1a1a1a] truncate">
            {participant.display_name}
          </span>
          {isMe && (
            <span className="text-[10px] font-bold text-[#4C1D80] bg-[#EEEDFE] px-1.5 py-0.5 rounded shrink-0">
              Tú
            </span>
          )}
          {isRoomHost && (
            <span className="text-[10px] font-bold text-white bg-[#4C1D80] px-1.5 py-0.5 rounded shrink-0">
              Anfitrión
            </span>
          )}
        </div>

        {/* Status chip */}
        {(showStatus || hasLoan) && (
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {showStatus && participant.amount_cents !== null && (
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full inline-block"
                style={{ backgroundColor: status.bg, color: status.textColor }}
              >
                {status.icon} {status.label}
              </span>
            )}

            {hasLoan && participant.confirmation_status === 'confirmed' && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full inline-block bg-orange-50 text-orange-700 border border-orange-100">
                💳 Le prestaron
              </span>
            )}
          </div>
        )}
      </div>

      {/* Monto */}
      <span className={`shrink-0 tabular-nums ${estimated ? 'text-[15px] font-semibold text-gray-500' : 'text-[16px] font-bold text-[#1a1a1a]'}`}>
        {participant.amount_cents !== null
          ? `${estimated ? '~' : ''}${formatMoney(participant.amount_cents)}`
          : '—'}
      </span>
    </div>
  );
}
