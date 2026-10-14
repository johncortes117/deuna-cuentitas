// ─── PayDebtSheet: pagarle a alguien lo que le debes ─────────
// Antes, si no alcanzaba el saldo, la hoja mostraba "Te faltan $7,26.
// Recarga desde tu cuenta principal" con el botón gris bloqueado: un callejón
// sin salida (volver al inicio, recargar, volver a deudas, abrir la deuda,
// pagar, confirmar). Ahora la recarga va en el mismo botón: un toque.
import type { Debt } from '../types';
import { formatMoney, relativeDate, topUpAmountFor, PRINCIPAL_ACCOUNT_LABEL } from '../utils';
import BottomSheet from './BottomSheet';
import Avatar from './Avatar';

interface PayDebtSheetProps {
  creditorName: string;
  debts: Debt[];
  roomNames: Record<string, string>;
  balanceCents: number;
  busy: boolean;
  level?: 0 | 1;
  // topUpCents = 0 si el saldo ya alcanzaba.
  onConfirm: (topUpCents: number) => void;
  onClose: () => void;
}

export default function PayDebtSheet({
  creditorName,
  debts,
  roomNames,
  balanceCents,
  busy,
  level = 0,
  onConfirm,
  onClose,
}: PayDebtSheetProps) {
  const totalCents = debts.reduce((acc, d) => acc + d.amount_cents, 0);
  const shortfall = Math.max(0, totalCents - balanceCents);
  const topUp = topUpAmountFor(shortfall);
  const balanceAfter = balanceCents + topUp - totalCents;

  return (
    <BottomSheet onClose={onClose} dismissible={!busy} level={level} label={`Pagar a ${creditorName}`}>
      <div className="flex flex-col items-center px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] overflow-y-auto">
        <h3 className="text-[18px] font-bold text-[#1a1a1a] mt-1 mb-4">Pagar a {creditorName}</h3>
        <Avatar name={creditorName} size={56} />
        <p className="text-[36px] font-black text-[#1a1a1a] leading-tight mt-2 tabular-nums">{formatMoney(totalCents)}</p>

        {/* De dónde viene (si son varias salas, el detalle) */}
        {debts.length > 1 ? (
          <div className="w-full mt-2 mb-1 space-y-1.5">
            {debts.map(d => (
              <div key={d.id} className="flex justify-between text-[13px]">
                <span className="text-gray-500 truncate pr-3">
                  {roomNames[d.room_id] || 'Sala MitiMiti'} · {relativeDate(d.created_at)}
                </span>
                <span className="font-semibold text-[#1a1a1a] tabular-nums">{formatMoney(d.amount_cents)}</span>
              </div>
            ))}
          </div>
        ) : debts[0] ? (
          <p className="text-[13px] text-gray-500 mb-1">
            {roomNames[debts[0].room_id] || 'Sala MitiMiti'} · {relativeDate(debts[0].created_at)}
          </p>
        ) : null}

        {/* Impacto en el saldo: transparencia total antes de mover plata */}
        <div className="w-full bg-[#F8F8FA] rounded-2xl p-4 space-y-2.5 my-4">
          <Row label="Tu saldo en Deuna" value={formatMoney(balanceCents)} />
          {topUp > 0 && (
            <Row label={`Recarga desde ${PRINCIPAL_ACCOUNT_LABEL}`} value={`+${formatMoney(topUp)}`} valueClass="text-[#4C1D80]" />
          )}
          <Row label="Te queda después de pagar" value={formatMoney(balanceAfter)} valueClass="text-[#3B6D11]" bold />
        </div>

        {topUp > 0 && (
          <p className="w-full text-[13px] text-gray-600 text-center mb-3">
            Te faltan {formatMoney(shortfall)}: recargamos {formatMoney(topUp)} y pagamos de una.
          </p>
        )}

        <button
          onClick={() => onConfirm(topUp)}
          disabled={busy}
          className={`w-full py-4 rounded-[14px] font-bold text-[16px] transition-all flex items-center justify-center gap-2 ${
            busy ? 'bg-[#4C1D80]/70 text-white cursor-wait' : 'bg-[#4C1D80] text-white active:scale-[0.98]'
          }`}
        >
          {busy && (
            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          )}
          {busy
            ? 'Pagando…'
            : topUp > 0
              ? `Recargar ${formatMoney(topUp)} y pagar`
              : `Pagar ${formatMoney(totalCents)}`}
        </button>
        <button
          onClick={onClose}
          disabled={busy}
          className="w-full py-3 mt-1.5 rounded-[14px] font-bold text-[15px] text-gray-500 active:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </BottomSheet>
  );
}

function Row({ label, value, valueClass = 'text-[#1a1a1a]', bold = false }: { label: string; value: string; valueClass?: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-[13px] text-gray-500">{label}</span>
      <span className={`text-[14px] tabular-nums ${bold ? 'font-bold' : 'font-semibold'} ${valueClass}`}>{value}</span>
    </div>
  );
}
