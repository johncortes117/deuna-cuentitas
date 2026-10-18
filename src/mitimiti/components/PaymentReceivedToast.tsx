// ─── PaymentReceivedToast: "Diego te pagó $22,18" ────────────
// Cerrar el ciclo del préstamo es lo que hace que la gente vuelva a prestar
// (y a recomendar MitiMiti): quien prestó tiene que ENTERARSE de que le
// pagaron, en la pantalla que esté, y ver la plata en su saldo.
//
// También avisa cuando un amigo responde el link de una deuda que anotaste a
// mano ("Juan aceptó: te debe $1,50"): sin ese aviso, mandar el link se
// sentiría como hablarle a la pared.
import { useEffect, useState } from 'react';
import {
  PAYMENT_RECEIVED_EVENT,
  DEBT_LINK_RESPONDED_EVENT,
  type PaymentReceivedDetail,
  type DebtLinkRespondedDetail,
} from '../useDebts';
import { formatMoney } from '../utils';

interface Notice {
  emoji: string;
  title: string;
  subtitle: string;
  good: boolean;
}

function paymentNotice({ debtorName, amountCents }: PaymentReceivedDetail): Notice {
  return {
    emoji: '💰',
    title: debtorName
      ? `${debtorName} te pagó ${formatMoney(amountCents)}`
      : `Te pagaron ${formatMoney(amountCents)}`,
    subtitle: 'Ya está en tu saldo de Deuna',
    good: true,
  };
}

function linkNotice({ responses }: DebtLinkRespondedDetail): Notice {
  if (responses.length > 1) {
    return { emoji: '🤝', title: `Respondieron ${responses.length} de tus links`, subtitle: 'Míralos en Mis deudas', good: true };
  }
  const { friendName, amountCents, accepted, lent } = responses[0];
  const amount = formatMoney(amountCents);
  if (accepted) {
    return lent
      ? { emoji: '🤝', title: `${friendName} aceptó: te debe ${amount}`, subtitle: 'Te avisaremos cuando te pague', good: true }
      : { emoji: '🤝', title: `${friendName} confirmó que le debes ${amount}`, subtitle: 'Págale cuando puedas desde Mis deudas', good: true };
  }
  return {
    emoji: '🤔',
    title: lent ? `${friendName} dice que no te debe ${amount}` : `${friendName} dice que no le debes ${amount}`,
    subtitle: 'Quizás ya lo arreglaron. Quedó en tu historial',
    good: false,
  };
}

export default function PaymentReceivedToast() {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const onPaid = (e: Event) => setNotice(paymentNotice((e as CustomEvent<PaymentReceivedDetail>).detail));
    const onLink = (e: Event) => setNotice(linkNotice((e as CustomEvent<DebtLinkRespondedDetail>).detail));
    window.addEventListener(PAYMENT_RECEIVED_EVENT, onPaid);
    window.addEventListener(DEBT_LINK_RESPONDED_EVENT, onLink);
    return () => {
      window.removeEventListener(PAYMENT_RECEIVED_EVENT, onPaid);
      window.removeEventListener(DEBT_LINK_RESPONDED_EVENT, onLink);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;

  return (
    <div className="absolute top-14 left-4 right-4 z-[200] animate-slideDown pointer-events-none" role="status">
      <div
        className={`bg-white rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.15)] border px-4 py-3 flex items-center gap-3 ${
          notice.good ? 'border-[#3B6D11]/15' : 'border-gray-200'
        }`}
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-[20px] shrink-0 ${
            notice.good ? 'bg-[#EAF3DE]' : 'bg-gray-100'
          }`}
          aria-hidden="true"
        >
          {notice.emoji}
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-[#1a1a1a]">{notice.title}</p>
          <p className="text-[12px] text-gray-500">{notice.subtitle}</p>
        </div>
      </div>
    </div>
  );
}
