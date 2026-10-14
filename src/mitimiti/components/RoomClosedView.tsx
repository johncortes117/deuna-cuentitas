// ─── RoomClosedView: la sala se canceló o se le acabó el tiempo ──
// Lo más importante que hay que decir aquí es que NO se cobró nada: es lo
// primero que piensa cualquiera al ver que "se cerró" algo con plata.
import type { Room } from '../types';
import { formatMoney, roomEmoji } from '../utils';

interface RoomClosedViewProps {
  room: Room;
  isHost: boolean;
  // true si la vimos vencer recién con la sala abierta en pantalla.
  expiredNow: boolean;
  onExit: () => void;
  onRecreate: () => void;
}

export default function RoomClosedView({ room, isHost, expiredNow, onExit, onRecreate }: RoomClosedViewProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>

      <h2 className="text-[20px] font-bold text-[#1a1a1a] mb-1">
        {expiredNow ? 'Se acabó el tiempo de la sala' : 'Esta sala ya se cerró'}
      </h2>
      <p className="text-[14px] font-semibold text-gray-600 mb-3">
        {roomEmoji(room.commerce_name)} {room.commerce_name} · {formatMoney(room.total_cents)}
      </p>
      <p className="text-[14px] text-gray-500 mb-7 max-w-[300px] leading-snug">
        {expiredNow
          ? 'Pasaron 15 minutos sin terminar el pago.'
          : 'Se canceló o pasaron los 15 minutos sin terminar el pago.'}{' '}
        No te preocupes: <span className="font-semibold text-[#1a1a1a]">no se cobró nada a nadie.</span>
      </p>

      <div className="w-full space-y-2.5">
        {isHost && (
          <button
            onClick={onRecreate}
            className="w-full py-4 rounded-[14px] bg-[#4C1D80] text-white text-[16px] font-bold active:scale-[0.98] transition-transform"
          >
            Crear la sala de nuevo
          </button>
        )}
        <button
          onClick={onExit}
          className={`w-full py-4 rounded-[14px] text-[16px] font-bold active:scale-[0.98] transition-transform ${
            isHost ? 'text-gray-600' : 'bg-gray-100 text-[#1a1a1a]'
          }`}
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
