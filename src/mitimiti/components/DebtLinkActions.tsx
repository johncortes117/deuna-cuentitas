// ─── DebtLinkActions: mandar el link de una deuda anotada a mano ──
// Lo mismo en las tres pantallas donde aparece un link (recién anotado, en
// Mis deudas y si abres tu propio link): WhatsApp como acción principal,
// porque es donde ya está la conversación con el amigo; copiar el link para
// cualquier otro chat; y el QR para cuando están juntos ("te presté en
// efectivo y aquí mismo lo anotamos").
import { useState } from 'react';
import type { Debt } from '../types';
import { getUserProfile } from '../utils';
import { openWhatsApp, copyText, debtLink, debtLinkMessage } from '../share';
import { trackEvent } from '../analytics';
import BottomSheet from './BottomSheet';
import QRInvite from './QRInvite';

interface DebtLinkActionsProps {
  debt: Debt;
  // Ya se mandó por WhatsApp: los tres canales quedan como botones
  // secundarios para que el botón grande de la pantalla sea "Listo".
  sent?: boolean;
  onSent?: () => void;
}

export default function DebtLinkActions({ debt, sent = false, onSent }: DebtLinkActionsProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const link = debt.invite_token ? debtLink(debt.invite_token) : '';

  const track = (channel: 'whatsapp' | 'copy' | 'qr') =>
    trackEvent('DEBT_LINK_SHARED', undefined, getUserProfile()?.userId, { debtId: debt.id, channel });

  const share = () => {
    if (openWhatsApp(debtLinkMessage(debt))) onSent?.();
    track('whatsapp');
  };

  const copy = async () => {
    if (!(await copyText(link))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
    track('copy');
  };

  const openQR = () => {
    setShowQR(true);
    track('qr');
  };

  const secondary = 'py-3 rounded-[14px] border-2 text-[14px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all';
  const idle = 'border-[#EBE3F5] bg-white text-[#4C1D80]';

  return (
    <>
      {!sent && (
        <button
          onClick={share}
          className="w-full py-4 mb-2.5 rounded-[14px] bg-[#4C1D80] text-white text-[16px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <ChatIcon size={18} />
          Enviar por WhatsApp
        </button>
      )}
      <div className={`grid gap-2.5 ${sent ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {sent && (
          <button onClick={share} className={`${secondary} ${idle}`}>
            <ChatIcon size={15} />
            Reenviar
          </button>
        )}
        <button
          onClick={copy}
          className={`${secondary} ${copied ? 'border-[#3B6D11]/30 bg-[#EAF3DE] text-[#3B6D11]' : idle}`}
          aria-live="polite"
        >
          {copied ? '✓ Copiado' : 'Copiar link'}
        </button>
        <button onClick={openQR} className={`${secondary} ${idle}`}>
          Mostrar QR
        </button>
      </div>

      {showQR && (
        // Nivel 1: a veces estas acciones ya viven dentro de otra hoja.
        <BottomSheet onClose={() => setShowQR(false)} level={1} label="Código QR de la deuda">
          <div className="flex flex-col items-center px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center">
            <h3 className="text-[18px] font-bold text-[#1a1a1a] mt-1">Que tu amigo escanee este código</h3>
            <p className="text-[14px] text-gray-500 mt-1">Con Deuna o con la cámara de su celular.</p>
            <div className="mt-2 mb-4">
              <QRInvite url={link} size={200} />
            </div>
            <button
              onClick={() => setShowQR(false)}
              className="w-full py-4 rounded-[14px] bg-[#4C1D80] text-white text-[16px] font-bold active:scale-[0.98] transition-transform"
            >
              Listo
            </button>
          </div>
        </BottomSheet>
      )}
    </>
  );
}

export function ChatIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}
