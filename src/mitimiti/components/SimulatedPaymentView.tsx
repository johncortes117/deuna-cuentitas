import { useState } from 'react';
import { toCents } from '../utils';

interface SimulatedPaymentViewProps {
  targetName: string;
  onPayAlone: (amountStr: string) => void;
  onPayMitiMiti: (roomName: string, amountStr: string) => void | Promise<void>;
  onClose: () => void;
}

export default function SimulatedPaymentView({ targetName, onPayAlone, onPayMitiMiti, onClose }: SimulatedPaymentViewProps) {
  const [amount, setAmount] = useState('0');
  const [creating, setCreating] = useState(false);

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
    if (amount.includes(',')) {
      const decimals = amount.split(',')[1];
      if (decimals && decimals.length >= 2) return;
    }
    setAmount(prev => (prev === '0' ? key : prev + key));
  };

  const hasAmount = toCents(amount) > 0;

  // El QR del local ya trae su nombre: la sala se llama así y se crea de una.
  // Antes había un modal "Nombra tu sala" con ese mismo nombre ya escrito,
  // que solo agregaba un toque (y abría el teclado del sistema).
  const handleMitiMiti = async () => {
    if (!hasAmount || creating) return;
    // La vista permanece montada durante el await (el padre solo navega
    // cuando la sala existe), así que el botón muestra el progreso.
    setCreating(true);
    try {
      await onPayMitiMiti(targetName, amount);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full bg-white absolute inset-0 z-50">
      {/* Header */}
      <div className="flex items-center px-5 pt-14 pb-3 shrink-0 border-b border-gray-100">
        <button onClick={onClose} className="mr-3" aria-label="Volver">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1 text-center pr-8">
          <p className="text-[13px] text-gray-500 font-medium">Pagar a</p>
          <h1 className="text-[16px] font-bold text-[#1a1a1a]">{targetName}</h1>
        </div>
      </div>

      {/* Monto */}
      <div className="text-center mt-3 mb-2 shrink-0">
        <p className="text-[#4C1D80] text-[13px] font-medium mb-1">
          Ingresa el valor a pagar
        </p>
        <p className="text-[46px] font-bold text-[#1a1a1a] leading-none tracking-tight">
          $ {amount}
        </p>
      </div>

      {/* Teclado numérico */}
      <div className="grid grid-cols-3 gap-y-1 px-5 flex-1 content-center">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'].map(key => (
          <button
            key={key}
            onClick={() => handleKey(key)}
            aria-label={key === 'del' ? 'Borrar' : key}
            className="flex items-center justify-center py-2.5 rounded-xl text-[28px] font-semibold text-[#4C1D80] active:bg-gray-100 transition-colors"
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

      {/* Acciones */}
      <div className="px-5 pt-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] shrink-0">
        <p className="text-[12px] text-gray-500 text-center mb-2">¿Pagan entre varios? Divide la cuenta con MitiMiti.</p>
        <div className="flex gap-3">
          <button
            onClick={() => onPayAlone(amount)}
            disabled={!hasAmount || creating}
            className={`flex-1 py-4 rounded-[16px] text-[15px] font-bold transition-all ${
              hasAmount
                ? 'bg-gray-100 text-[#1a1a1a] active:bg-gray-200'
                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
            }`}
          >
            Pagar ${amount}
          </button>

          <button
            onClick={handleMitiMiti}
            disabled={!hasAmount || creating}
            className={`flex-1 py-4 rounded-[16px] text-[15px] font-bold transition-all flex items-center justify-center gap-2 ${
              hasAmount
                ? 'bg-[#4C1D80] text-white active:scale-[0.98]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            } ${creating ? 'opacity-80 cursor-wait' : ''}`}
          >
            {creating ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <span aria-hidden="true">🤝</span>
            )}
            <span>{creating ? 'Creando sala…' : 'Dividir cuenta'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
