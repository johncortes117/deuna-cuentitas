// ─── InsufficientFundsModal: "Te faltan $X" con dos salidas reales ──
// Antes la única salida era pedir un préstamo, y el segundo botón decía
// "Salir de la sala" pero solo cerraba el modal. Ahora:
//   1. Recargar desde la cuenta principal y aceptar, en UN toque (sin deuda).
//   2. Pedir que alguien de la sala preste lo que falta (el diferenciador).
import { formatMoney, topUpAmountFor, PRINCIPAL_ACCOUNT_LABEL } from '../utils';
import BottomSheet from './BottomSheet';

interface Props {
  amountCents: number;
  balanceCents: number;
  busy: boolean;
  // El préstamo solo tiene sentido si hay alguien más en la sala.
  canRequestLoan: boolean;
  onTopUp: (topUpCents: number) => void;
  onRequestLoan: () => void;
  onClose: () => void;
}

export default function InsufficientFundsModal({
  amountCents,
  balanceCents,
  busy,
  canRequestLoan,
  onTopUp,
  onRequestLoan,
  onClose,
}: Props) {
  const deficit = Math.max(0, amountCents - balanceCents);
  const topUp = topUpAmountFor(deficit);

  return (
    <BottomSheet onClose={onClose} dismissible={!busy} label="No te alcanza el saldo">
      <div className="px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-col items-center">
        <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center text-[28px] mt-1 mb-3" aria-hidden="true">
          👛
        </div>
        <h2 className="text-[21px] font-bold text-[#1a1a1a] text-center">Te faltan {formatMoney(deficit)}</h2>
        <p className="text-[14px] text-gray-500 text-center mt-1 mb-5">
          Tu parte es {formatMoney(amountCents)} y en Deuna tienes {formatMoney(balanceCents)}.
        </p>

        <button
          onClick={() => onTopUp(topUp)}
          disabled={busy}
          className="w-full flex items-center gap-3 p-4 rounded-[18px] bg-[#4C1D80] text-white text-left active:scale-[0.98] transition-transform disabled:opacity-70 mb-3"
        >
          <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-[20px] shrink-0" aria-hidden="true">💳</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[16px] font-bold">
              {busy ? 'Recargando…' : `Recargar ${formatMoney(topUp)} y aceptar`}
            </span>
            <span className="block text-[12px] text-white/75">Desde tu cuenta {PRINCIPAL_ACCOUNT_LABEL}</span>
          </span>
        </button>

        {canRequestLoan && (
          <button
            onClick={onRequestLoan}
            disabled={busy}
            className="w-full flex items-center gap-3 p-4 rounded-[18px] bg-white border-2 border-[#EBE3F5] text-left active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            <span className="w-10 h-10 rounded-full bg-[#F6F1FD] flex items-center justify-center text-[20px] shrink-0" aria-hidden="true">🙋</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[16px] font-bold text-[#4C1D80]">Pedir que me presten {formatMoney(deficit)}</span>
              <span className="block text-[12px] text-gray-500">Alguien de la sala te cubre y queda anotado en Mis deudas</span>
            </span>
          </button>
        )}

        <button
          onClick={onClose}
          disabled={busy}
          className="mt-3 py-2.5 px-6 text-[15px] font-semibold text-gray-500 active:opacity-70"
        >
          Ahora no
        </button>
      </div>
    </BottomSheet>
  );
}
