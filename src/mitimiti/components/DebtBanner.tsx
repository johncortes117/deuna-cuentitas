import type { Debt } from '../types';
import { formatMoney } from '../utils';

interface Props {
  debt: Debt;
  onPay: () => void;
  onDismiss: () => void;
}

export default function DebtBanner({ debt, onPay, onDismiss }: Props) {
  return (
    <div className="mx-5 mb-4 bg-orange-50 border border-orange-100 rounded-[16px] p-3 flex items-center justify-between shrink-0 shadow-sm animate-slideUp">
      <div className="flex items-center gap-3">
        <div className="text-[20px]">🔴</div>
        <div>
          <p className="text-[#1a1a1a] text-[13px] font-medium leading-tight">
            Tienes una deuda con <span className="font-bold">{debt.creditor_name}</span>
          </p>
          <p className="text-orange-600 font-bold text-[14px]">
            {formatMoney(debt.amount_cents)}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1 items-end">
        <button 
          onClick={onDismiss}
          className="text-gray-400 p-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <button 
          onClick={onPay}
          className="bg-[#4C1D80] text-white text-[12px] font-bold px-3 py-1.5 rounded-[10px] active:scale-95 transition-transform"
        >
          Liquidar
        </button>
      </div>
    </div>
  );
}
