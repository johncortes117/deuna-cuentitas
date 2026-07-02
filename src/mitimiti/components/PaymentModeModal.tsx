// ─── PaymentModeModal: "¿Pagar solo o MitiMiti?" ─────────────

interface PaymentModeModalProps {
  targetName: string;
  amount: string; // formato display: "48,00"
  onPayAlone: () => void;
  onMitiMiti: () => void;
  onClose: () => void;
}

export default function PaymentModeModal({
  targetName,
  amount,
  onPayAlone,
  onMitiMiti,
  onClose,
}: PaymentModeModalProps) {
  return (
    <div className="mitimiti-backdrop" onClick={onClose}>
      <div
        className="mitimiti-modal mitimiti-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        {/* Info del pago */}
        <div className="text-center mb-6">
          <p className="text-[14px] text-gray-400 mb-1">Pagar a</p>
          <p className="text-[18px] font-bold text-[#1a1a1a] mb-3">{targetName}</p>
          <p className="text-[36px] font-bold text-[#1a1a1a] leading-none">
            ${amount}
          </p>
        </div>

        {/* Opciones */}
        <div className="space-y-3">
          <button
            onClick={onPayAlone}
            className="w-full py-4 rounded-[14px] bg-gray-100 text-[#1a1a1a] text-[16px] font-bold active:scale-[0.98] transition-transform"
          >
            Pagar
          </button>

          <button
            onClick={onMitiMiti}
            className="w-full py-4 rounded-[14px] bg-[#4C1D80] text-white text-[16px] font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <span>🤝</span>
            <span>MitiMiti</span>
          </button>
        </div>
      </div>
    </div>
  );
}
