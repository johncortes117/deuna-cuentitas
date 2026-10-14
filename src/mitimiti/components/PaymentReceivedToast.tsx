// ─── PaymentReceivedToast: "Diego te pagó $22,18" ────────────
// Cerrar el ciclo del préstamo es lo que hace que la gente vuelva a prestar
// (y a recomendar MitiMiti): quien prestó tiene que ENTERARSE de que le
// pagaron, en la pantalla que esté, y ver la plata en su saldo.
import { useEffect, useState } from 'react';
import { PAYMENT_RECEIVED_EVENT, type PaymentReceivedDetail } from '../useDebts';
import { formatMoney } from '../utils';

export default function PaymentReceivedToast() {
  const [detail, setDetail] = useState<PaymentReceivedDetail | null>(null);

  useEffect(() => {
    const onPaid = (e: Event) => setDetail((e as CustomEvent<PaymentReceivedDetail>).detail);
    window.addEventListener(PAYMENT_RECEIVED_EVENT, onPaid);
    return () => window.removeEventListener(PAYMENT_RECEIVED_EVENT, onPaid);
  }, []);

  useEffect(() => {
    if (!detail) return;
    const timer = setTimeout(() => setDetail(null), 4500);
    return () => clearTimeout(timer);
  }, [detail]);

  if (!detail) return null;

  return (
    <div className="absolute top-14 left-4 right-4 z-[200] animate-slideDown pointer-events-none" role="status">
      <div className="bg-white rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.15)] border border-[#3B6D11]/15 px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#EAF3DE] flex items-center justify-center text-[20px] shrink-0" aria-hidden="true">
          💰
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-[#1a1a1a]">
            {detail.debtorName
              ? `${detail.debtorName} te pagó ${formatMoney(detail.amountCents)}`
              : `Te pagaron ${formatMoney(detail.amountCents)}`}
          </p>
          <p className="text-[12px] text-gray-500">Ya está en tu saldo de Deuna</p>
        </div>
      </div>
    </div>
  );
}
