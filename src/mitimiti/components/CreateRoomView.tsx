// ─── CreateRoomView: Crear sala con monto ────────────────────
import { useState } from 'react';

interface CreateRoomViewProps {
  initialCommerceName?: string;
  initialAmount?: string; // "48,00"
  onCreateRoom: (commerceName: string, amountStr: string) => void;
  onBack: () => void;
}

export default function CreateRoomView({
  initialCommerceName = '',
  initialAmount = '0',
  onCreateRoom,
  onBack,
}: CreateRoomViewProps) {
  const [commerceName, setCommerceName] = useState(initialCommerceName);
  const [amount, setAmount] = useState(initialAmount);

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
  const hasName = commerceName.trim() !== '';

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

      {/* Input nombre */}
      <div className="px-5 mb-2 shrink-0">
        <input
          type="text"
          placeholder="Nombre (ej. Almuerzo equipo)"
          value={commerceName}
          onChange={e => setCommerceName(e.target.value)}
          className="w-full bg-[#F8F8FA] border border-gray-100 rounded-2xl py-3.5 px-4 text-[14px] text-[#1a1a1a] focus:outline-none focus:border-[#4C1D80] focus:ring-1 focus:ring-[#4C1D80] transition-colors placeholder:text-gray-400"
        />
      </div>

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
      <div className="px-5 pb-4 shrink-0">
        <button
          onClick={() => onCreateRoom(commerceName, amount)}
          disabled={!hasAmount || !hasName}
          className={`w-full py-4 rounded-[14px] text-[16px] font-bold transition-all ${
            hasAmount && hasName
              ? 'bg-[#4C1D80] text-white active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Crear sala
        </button>
      </div>
    </div>
  );
}
