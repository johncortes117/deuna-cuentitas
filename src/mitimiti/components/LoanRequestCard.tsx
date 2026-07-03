import { useState, useEffect } from 'react';
import type { Participant } from '../types';
import { formatMoney, fromCents, toCents } from '../utils';

interface Props {
  participant: Participant;
  onLendMoney: (amountCents: number) => void;
  myBalance: number;
}

export default function LoanRequestCard({ participant, onLendMoney, myBalance }: Props) {
  const [amountStr, setAmountStr] = useState(fromCents(participant.deficit_cents));

  // Sync when deficit changes (e.g. partial loan received)
  useEffect(() => {
    setAmountStr(fromCents(participant.deficit_cents));
  }, [participant.deficit_cents]);

  const handleAmountChange = (val: string) => {
    if (/^[0-9,]*$/.test(val)) {
      setAmountStr(val);
    }
  };

  const amountCents = toCents(amountStr);
  const isValid = amountCents > 0 && amountCents <= participant.deficit_cents && amountCents <= myBalance;

  return (
    <div className="ml-14 mr-4 mt-2 mb-4 bg-orange-50 border border-orange-100 rounded-[20px] p-4 relative overflow-hidden">
      {/* Decorative pulse */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-orange-200 rounded-bl-[100px] opacity-30 pointer-events-none" />
      
      <div className="flex items-start gap-3 relative z-10">
        <div className="mt-1 text-[20px]">💜</div>
        <div className="flex-1">
          <h4 className="text-[#1a1a1a] font-bold text-[14px] leading-tight mb-1">
            Le faltan {formatMoney(participant.deficit_cents)}
          </h4>
          
          <div className="mt-3 flex items-center gap-2 bg-white rounded-[12px] p-1 border border-orange-200/50">
            <span className="text-orange-500 font-bold pl-3">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="flex-1 w-full bg-transparent border-none focus:ring-0 text-[#1a1a1a] font-bold px-1"
            />
            <button
              onClick={() => onLendMoney(amountCents)}
              disabled={!isValid}
              className={`py-1.5 px-4 rounded-[10px] text-[14px] font-bold transition-all ${
                isValid 
                  ? 'bg-orange-500 text-white active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Prestar
            </button>
          </div>
          
          {!isValid && amountCents > myBalance && (
            <p className="text-red-500 text-[12px] mt-1 ml-1 font-medium">
              No tienes saldo suficiente
            </p>
          )}
          
          <p className="text-gray-400 text-[11px] mt-2 ml-1 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Se registrará como deuda oficial
          </p>
        </div>
      </div>
    </div>
  );
}
