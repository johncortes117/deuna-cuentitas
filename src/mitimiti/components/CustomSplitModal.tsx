import { useState, useEffect } from 'react';
import type { Participant } from '../types';
import { formatMoney, fromCents, toCents, dividirMonto, validateCustomSplit } from '../utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  totalCents: number;
  onConfirm: (splitMode: 'equal' | 'custom', amounts?: { userId: string, amountCents: number }[]) => void;
}

export default function CustomSplitModal({ isOpen, onClose, participants, totalCents, onConfirm }: Props) {
  const [mode, setMode] = useState<'equal' | 'custom'>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setMode('equal');
      // Initialize equal amounts
      const equalAmounts = dividirMonto(totalCents, participants.length);
      const initial: Record<string, string> = {};
      participants.forEach((p, i) => {
        initial[p.user_id] = fromCents(equalAmounts[i]);
      });
      setCustomAmounts(initial);
    }
  }, [isOpen, participants, totalCents]);

  if (!isOpen) return null;

  const handleAmountChange = (userId: string, val: string) => {
    // Solo permitir números y comas
    if (/^[0-9,]*$/.test(val)) {
      setCustomAmounts(prev => ({ ...prev, [userId]: val }));
    }
  };

  const currentAmounts = participants.map(p => ({
    userId: p.user_id,
    amountCents: toCents(customAmounts[p.user_id] || '0')
  }));

  const validation = validateCustomSplit(currentAmounts.map(a => a.amountCents), totalCents);
  const isValid = mode === 'equal' || validation.valid;

  const handleConfirm = () => {
    if (mode === 'equal') {
      onConfirm('equal');
    } else {
      if (isValid) {
        onConfirm('custom', currentAmounts);
      }
    }
  };

  return (
    <>
      <div 
        className="absolute inset-0 bg-black/40 z-40 md:rounded-[43px] transition-opacity" 
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] md:rounded-b-[43px] z-50 flex flex-col max-h-[85%] animate-slideUp overflow-hidden">
        
        {/* Header */}
        <div className="flex flex-col items-center pt-3 pb-4 px-6 border-b border-gray-100 shrink-0 relative">
          <div className="w-10 h-1 bg-gray-200 rounded-full mb-4" />
          <h2 className="text-[20px] font-bold text-[#1a1a1a]">Dividir cuenta</h2>
          <p className="text-[14px] text-gray-500 mt-1">Total: {formatMoney(totalCents)}</p>
          <button 
            onClick={onClose}
            className="absolute right-6 top-6 w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-500 rounded-full active:scale-95"
          >
            ×
          </button>
        </div>

        {/* Toggle Mode */}
        <div className="px-6 py-4 shrink-0">
          <div className="mitimiti-toggle-container">
            <div 
              className={`mitimiti-toggle-slider ${mode === 'custom' ? 'translate-x-full' : 'translate-x-0'}`} 
            />
            <button
              className={`mitimiti-toggle-btn ${mode === 'equal' ? 'text-[#1a1a1a]' : 'text-gray-500'}`}
              onClick={() => setMode('equal')}
            >
              Partes iguales
            </button>
            <button
              className={`mitimiti-toggle-btn ${mode === 'custom' ? 'text-[#1a1a1a]' : 'text-gray-500'}`}
              onClick={() => setMode('custom')}
            >
              Personalizar
            </button>
          </div>
        </div>

        {/* Validation Banner (solo en custom) */}
        {mode === 'custom' && (
          <div className="px-6 pb-2 shrink-0">
            {validation.valid ? (
              <div className="bg-green-50 text-green-700 px-4 py-2 rounded-xl text-[14px] font-medium flex items-center gap-2">
                <span>✅</span> ¡La suma cuadra perfecto!
              </div>
            ) : (
              <div className="bg-orange-50 text-orange-700 px-4 py-2 rounded-xl text-[14px] font-medium flex items-center gap-2">
                <span>⚠️</span> 
                {validation.difference > 0 
                  ? `Faltan ${formatMoney(validation.difference)} por asignar` 
                  : `Sobran ${formatMoney(Math.abs(validation.difference))} asignados de más`
                }
              </div>
            )}
          </div>
        )}

        {/* Lista de participantes */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[14px]"
                  style={{ backgroundColor: p.user_id === participants[0].user_id ? '#4C1D80' : '#888' }}
                >
                  {p.display_name.slice(0, 2).toUpperCase()}
                </div>
                <span className="font-semibold text-[#1a1a1a] text-[15px]">
                  {p.display_name} {p.role === 'host' && '(Tú)'}
                </span>
              </div>
              
              <div className="flex items-center gap-1">
                <span className="text-[#4C1D80] font-bold text-[18px]">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={customAmounts[p.user_id] || ''}
                  onChange={(e) => handleAmountChange(p.user_id, e.target.value)}
                  disabled={mode === 'equal'}
                  className={`w-[80px] text-right font-bold text-[18px] border-none focus:outline-none focus:ring-0 ${
                    mode === 'equal' ? 'bg-transparent text-[#1a1a1a]' : 'bg-gray-100 rounded-lg px-2 py-1 text-[#4C1D80]'
                  }`}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer / CTA */}
        <div className="p-6 pt-4 shrink-0 bg-white border-t border-gray-50">
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className={`w-full py-[16px] rounded-[18px] text-[17px] font-bold transition-all ${
              isValid 
                ? 'bg-[#4C1D80] text-white active:scale-[0.98]' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {mode === 'equal' ? 'Confirmar división igual' : 'Confirmar montos'}
          </button>
        </div>
      </div>
    </>
  );
}
