import { useState, useEffect } from 'react';
import { useDebts } from '../useDebts';
import { getActiveRoomForUser } from '../supabase';
import { getUserProfile } from '../utils';
import type { Room } from '../types';

interface CreateRoomViewProps {
  initialCommerceName?: string;
  initialAmount?: string; // "48,00"
  onCreateRoom: (commerceName: string, amountStr: string) => void;
  onRejoinRoom: (roomId: string) => void;
  onBack: () => void;
}

export default function CreateRoomView({
  initialCommerceName = '',
  initialAmount = '0',
  onCreateRoom,
  onRejoinRoom,
  onBack,
}: CreateRoomViewProps) {
  const [commerceName, setCommerceName] = useState(initialCommerceName);
  const [amount, setAmount] = useState(initialAmount);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const { debtsIOwe } = useDebts();

  useEffect(() => {
    async function fetchActiveRoom() {
      const profile = getUserProfile();
      if (!profile) return;
      const room = await getActiveRoomForUser(profile.userId);
      setActiveRoom(room);
    }
    fetchActiveRoom();
  }, []);

  const handleKey = (key: string) => {
    if (key === 'del') {
      setAmount(prev => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
      return;
    }
    if (key === ',') {
      if (amount.includes(',')) return;
      setAmount(prev => prev + ',');
      return;
    }
    // Limitar decimales a 2
    if (amount.includes(',')) {
      const decimals = amount.split(',')[1];
      if (decimals && decimals.length >= 2) return;
    }
    setAmount(prev => (prev === '0' ? key : prev + key));
  };

  const hasAmount = amount !== '0' && amount !== '';

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

      {/* Session Recovery Banner */}
      {activeRoom && (
        <div className="mx-5 mb-4 p-4 rounded-2xl bg-[#F8F5FB] border border-[#EBE3F5] flex flex-col gap-3 shadow-sm animate-fadeIn">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-bold text-[#4C1D80] uppercase tracking-wide mb-0.5">Sala Activa</p>
              <p className="text-[16px] font-bold text-[#1a1a1a]">{activeRoom.commerce_name}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#4C1D80]/10 flex items-center justify-center">
              <span className="animate-pulse w-2.5 h-2.5 bg-[#4C1D80] rounded-full"></span>
            </div>
          </div>
          <button 
            onClick={() => onRejoinRoom(activeRoom.id)}
            className="w-full py-3 bg-[#4C1D80] text-white rounded-[12px] font-bold text-[14px] active:scale-95 transition-transform"
          >
            Volver a la sala
          </button>
        </div>
      )}

      {/* Monto */}
      <div className="text-center mt-3 mb-3 shrink-0">
        <p className="text-[#4C1D80] text-[13px] font-medium mb-1">
          ¿Cuánto van a pagar?
        </p>
        <p className="text-[48px] font-bold text-[#1a1a1a] leading-none tracking-tight">
          $ {amount}
        </p>
      </div>

      {/* Teclado numérico */}
      <div className="grid grid-cols-3 gap-y-1 px-5 flex-1 content-center">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'].map(key => (
          <button
            key={key}
            onClick={() => handleKey(key)}
            className="flex items-center justify-center py-3 rounded-xl text-[28px] font-semibold text-[#4C1D80] active:bg-gray-100 transition-colors"
          >
            {key === 'del' ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4C1D80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                <line x1="18" y1="9" x2="12" y2="15" />
                <line x1="12" y1="9" x2="18" y2="15" />
              </svg>
            ) : key}
          </button>
        ))}
      </div>

      {/* CTA */}
      <div className="px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shrink-0">
        <button
          onClick={() => setShowRoomModal(true)}
          disabled={!hasAmount}
          className={`w-full py-4 rounded-[14px] text-[16px] font-bold transition-all ${
            hasAmount
              ? 'bg-[#4C1D80] text-white active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Continuar
        </button>
        
        {debtsIOwe.length > 0 && (
          <button
            onClick={() => window.location.hash = '#/mitimiti/debts'}
            className="w-full mt-4 py-4 rounded-[14px] flex items-center justify-center gap-2 bg-orange-50 text-orange-600 font-bold active:scale-[0.98] transition-transform border border-orange-100"
          >
            <span className="text-[18px]">🔴</span>
            Tienes {debtsIOwe.length} {debtsIOwe.length === 1 ? 'deuda' : 'deudas'} por pagar
          </button>
        )}
        
        {debtsIOwe.length === 0 && (
          <button
            onClick={() => window.location.hash = '#/mitimiti/debts'}
            className="w-full mt-4 py-4 rounded-[14px] flex items-center justify-center gap-2 bg-[#F8F8FA] text-[#1a1a1a] font-bold active:scale-[0.98] transition-transform"
          >
            Ver mis deudas
          </button>
        )}
      </div>

      {/* Modal para Nombre de Sala */}
      {showRoomModal && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-start justify-center pt-4 px-4 animate-fadeIn" onClick={() => setShowRoomModal(false)}>
          <div className="bg-white w-full rounded-3xl p-6 shadow-2xl animate-slideDown" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
            <h3 className="text-[22px] font-bold text-[#1a1a1a] mb-2 text-center">Nombra tu sala</h3>
            <p className="text-[15px] text-gray-500 mb-6 text-center">Para crear la sala de pago grupal, ponle un nombre (ej. Almuerzo)</p>
            
            <input
              type="text"
              value={commerceName}
              onChange={(e) => setCommerceName(e.target.value)}
              placeholder="Nombre (ej. Almuerzo equipo)"
              className="w-full bg-[#F8F8FA] border border-gray-100 rounded-2xl py-3 px-4 text-[16px] text-[#1a1a1a] focus:outline-none focus:border-[#4C1D80] focus:ring-1 focus:ring-[#4C1D80] transition-colors mb-5"
              autoFocus
            />

            <button
              onClick={() => onCreateRoom(commerceName, amount)}
              disabled={!commerceName.trim()}
              className={`w-full py-4 rounded-[16px] text-[16px] font-bold transition-all ${
                commerceName.trim()
                  ? 'bg-[#4C1D80] text-white active:scale-[0.98]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Crear sala
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
