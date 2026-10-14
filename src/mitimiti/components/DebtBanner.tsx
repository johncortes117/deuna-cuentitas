import type { Debt } from '../types';
import { formatMoney } from '../utils';

interface Props {
  creditorName: string;
  debts: Debt[];
  onPay: () => void;
  onDismiss: () => void;
}

// Recordatorio en contexto: estás en una sala con alguien a quien le debes.
// Es el mejor momento para saldar ("ya que estamos juntos…"), pero sin
// estorbar: se puede cerrar y el pago pasa por la misma confirmación de
// siempre (antes pagaba con un solo toque y avisaba con un alert).
export default function DebtBanner({ creditorName, debts, onPay, onDismiss }: Props) {
  const total = debts.reduce((acc, d) => acc + d.amount_cents, 0);

  return (
    <div className="mx-5 bg-orange-50 border border-orange-100 rounded-[16px] p-3 flex items-center gap-3 shrink-0 animate-fadeIn">
      <span className="text-[20px]" aria-hidden="true">🧾</span>
      <p className="flex-1 min-w-0 text-[13px] text-[#1a1a1a] leading-snug">
        Le debes <span className="font-bold">{formatMoney(total)}</span> a <span className="font-bold">{creditorName}</span>
      </p>
      <button
        onClick={onPay}
        className="bg-[#4C1D80] text-white text-[13px] font-bold px-3.5 py-1.5 rounded-full active:scale-95 transition-transform shrink-0"
      >
        Pagar
      </button>
      <button onClick={onDismiss} aria-label="Ocultar" className="text-gray-400 p-1 -mr-1 shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
