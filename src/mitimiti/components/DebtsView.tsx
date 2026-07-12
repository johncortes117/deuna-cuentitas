// ─── DebtsView: Deudas MitiMiti (nivel banca: detalle + confirmación) ──
import { useState, useEffect, useMemo } from 'react';
import { useDebts } from '../useDebts';
import { useBalance } from '../useBalance';
import { formatMoney, getUserProfile } from '../utils';
import { getRoomNames } from '../supabase';
import { trackEvent } from '../analytics';
import type { Debt } from '../types';

// ─── Helpers de fecha (copy humano, sin jerga) ────────────────
function relativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('es-EC', opts);
}

function fullDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })} · ${d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`;
}

function avatarColor(name: string): string {
  return `hsl(${Math.abs(name.charCodeAt(0) * 37) % 360}, 65%, 55%)`;
}

function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: avatarColor(name), width: size, height: size }}
    >
      <span className="text-white font-bold" style={{ fontSize: size * 0.32 }}>
        {name.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
}

type ConfirmAction = { type: 'pay'; debt: Debt } | { type: 'forgive'; debt: Debt } | null;

export default function DebtsView({ onBack }: { onBack: () => void }) {
  const { debtsIOwe, debtsOwedToMe, history, settleDebt, forgiveDebt, isLoading, refresh } = useDebts();
  const { balance, deduct } = useBalance();
  const [tab, setTab] = useState<'owe' | 'owed' | 'history'>('owe');
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [roomNames, setRoomNames] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const profile = useMemo(() => getUserProfile(), []);
  const userId = profile?.userId || '';

  useEffect(() => {
    trackEvent('DEBTS_VIEW_OPENED', undefined, userId);
  }, [userId]);

  // Cargar nombres de las salas de origen (contexto clave de cada deuda)
  const roomIdsKey = useMemo(
    () => [...new Set([...debtsIOwe, ...debtsOwedToMe, ...history].map(d => d.room_id))].sort().join(','),
    [debtsIOwe, debtsOwedToMe, history],
  );
  useEffect(() => {
    if (!roomIdsKey) return;
    getRoomNames(roomIdsKey.split(',')).then(setRoomNames).catch(() => {});
  }, [roomIdsKey]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const totalIOwe = debtsIOwe.reduce((acc, d) => acc + d.amount_cents, 0);
  const totalOwedToMe = debtsOwedToMe.reduce((acc, d) => acc + d.amount_cents, 0);

  // ─── Acciones con dinero (siempre pasan por confirmación) ───
  const handleConfirmPay = async (debt: Debt) => {
    setProcessing(true);
    try {
      await settleDebt(debt.id);
      deduct(debt.amount_cents);
      trackEvent('DEBT_PAID', debt.room_id, userId, { debtId: debt.id, amountCents: debt.amount_cents });
      await refresh();
      setConfirmAction(null);
      setSelectedDebt(null);
      showToast(`Pagaste ${formatMoney(debt.amount_cents)} a ${debt.creditor_name}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmForgive = async (debt: Debt) => {
    setProcessing(true);
    try {
      await forgiveDebt(debt.id);
      trackEvent('DEBT_FORGIVEN', debt.room_id, userId, { debtId: debt.id, amountCents: debt.amount_cents });
      await refresh();
      setConfirmAction(null);
      setSelectedDebt(null);
      showToast(`Perdonaste la deuda de ${debt.debtor_name}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRemind = (debt: Debt) => {
    trackEvent('DEBT_REMINDER_SENT', debt.room_id, userId, { debtId: debt.id, debtorId: debt.debtor_id });
    showToast(`Le recordamos a ${debt.debtor_name} su deuda`);
  };

  const roomNameOf = (debt: Debt) => roomNames[debt.room_id] || 'Sala MitiMiti';

  return (
    <div className="flex flex-col flex-1 bg-[#F8F8FA] h-full relative">
      {/* Header */}
      <div className="bg-white flex items-center px-5 pt-14 pb-4 shrink-0 shadow-sm z-10 relative">
        <button onClick={onBack} className="absolute left-5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-[17px] font-bold text-[#1a1a1a] w-full text-center">Mis Deudas</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white px-5 pt-2 pb-0 flex gap-4 border-b border-gray-100 shrink-0">
        <button
          onClick={() => setTab('owe')}
          className={`pb-3 font-semibold text-[14px] px-1 relative ${tab === 'owe' ? 'text-[#4C1D80]' : 'text-gray-400'}`}
        >
          Debes
          {debtsIOwe.length > 0 && <span className="ml-1.5 bg-[#00C2E0] text-white text-[10px] px-1.5 py-0.5 rounded-full">{debtsIOwe.length}</span>}
          {tab === 'owe' && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#4C1D80] rounded-t-md" />}
        </button>
        <button
          onClick={() => setTab('owed')}
          className={`pb-3 font-semibold text-[14px] px-1 relative ${tab === 'owed' ? 'text-[#4C1D80]' : 'text-gray-400'}`}
        >
          Te deben
          {debtsOwedToMe.length > 0 && <span className="ml-1.5 bg-[#00C2E0] text-white text-[10px] px-1.5 py-0.5 rounded-full">{debtsOwedToMe.length}</span>}
          {tab === 'owed' && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#4C1D80] rounded-t-md" />}
        </button>
        <button
          onClick={() => setTab('history')}
          className={`pb-3 font-semibold text-[14px] px-1 relative ml-auto ${tab === 'history' ? 'text-[#4C1D80]' : 'text-gray-400'}`}
        >
          Historial
          {tab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#4C1D80] rounded-t-md" />}
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map(i => (
              <div key={i} className="bg-white rounded-[20px] h-[84px] animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : (
          <>
            {tab === 'owe' && (
              <div className="animate-fadeIn">
                {debtsIOwe.length === 0 ? (
                  <EmptyState emoji="🎉" title="No debes nada" subtitle="Cuando pidas un préstamo en una sala, aparecerá aquí" />
                ) : (
                  <>
                    <SummaryCard label="Total que debes" totalCents={totalIOwe} count={debtsIOwe.length} />
                    <div className="space-y-3">
                      {debtsIOwe.map(debt => (
                        <DebtCard
                          key={debt.id}
                          name={debt.creditor_name}
                          directionLabel="Le debes a"
                          contextLine={`${roomNameOf(debt)} · ${relativeDate(debt.created_at)}`}
                          amountCents={debt.amount_cents}
                          onOpen={() => {
                            trackEvent('DEBT_DETAIL_OPENED', debt.room_id, userId, { debtId: debt.id });
                            setSelectedDebt(debt);
                          }}
                          quickActionLabel="Pagar"
                          onQuickAction={() => setConfirmAction({ type: 'pay', debt })}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === 'owed' && (
              <div className="animate-fadeIn">
                {debtsOwedToMe.length === 0 ? (
                  <EmptyState emoji="🤝" title="Nadie te debe" subtitle="Cuando prestes dinero en una sala, aparecerá aquí" />
                ) : (
                  <>
                    <SummaryCard label="Total que te deben" totalCents={totalOwedToMe} count={debtsOwedToMe.length} positive />
                    <div className="space-y-3">
                      {debtsOwedToMe.map(debt => (
                        <DebtCard
                          key={debt.id}
                          name={debt.debtor_name}
                          directionLabel="Te debe"
                          contextLine={`${roomNameOf(debt)} · ${relativeDate(debt.created_at)}`}
                          amountCents={debt.amount_cents}
                          positive
                          onOpen={() => {
                            trackEvent('DEBT_DETAIL_OPENED', debt.room_id, userId, { debtId: debt.id });
                            setSelectedDebt(debt);
                          }}
                          quickActionLabel="Recordar"
                          onQuickAction={() => handleRemind(debt)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === 'history' && (
              <div className="space-y-3 animate-fadeIn">
                {history.length === 0 ? (
                  <EmptyState emoji="🗂️" title="Sin movimientos aún" subtitle="Aquí verás las deudas pagadas o perdonadas" />
                ) : (
                  history.map(debt => (
                    <HistoryItem
                      key={debt.id}
                      debt={debt}
                      userId={userId}
                      onOpen={() => setSelectedDebt(debt)}
                    />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sheet de detalle de deuda */}
      {selectedDebt && !confirmAction && (
        <DebtDetailSheet
          debt={selectedDebt}
          userId={userId}
          roomName={roomNameOf(selectedDebt)}
          onClose={() => setSelectedDebt(null)}
          onPay={() => setConfirmAction({ type: 'pay', debt: selectedDebt })}
          onForgive={() => setConfirmAction({ type: 'forgive', debt: selectedDebt })}
          onRemind={() => handleRemind(selectedDebt)}
        />
      )}

      {/* Sheet de confirmación (doble aceptación para acciones con dinero) */}
      {confirmAction && (
        <ConfirmSheet
          action={confirmAction}
          balance={balance}
          processing={processing}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            if (confirmAction.type === 'pay') handleConfirmPay(confirmAction.debt);
            else handleConfirmForgive(confirmAction.debt);
          }}
        />
      )}

      {/* Toast de éxito */}
      {toast && (
        <div className="absolute top-16 left-5 right-5 z-[70] bg-[#EAF3DE] border border-[#3B6D11]/20 rounded-2xl px-4 py-3 flex items-center gap-2 shadow-lg animate-fadeIn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B6D11" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p className="text-[13px] font-semibold text-[#3B6D11]">{toast}</p>
        </div>
      )}
    </div>
  );
}

// ─── Resumen agregado (lo primero que busca el usuario) ───────
function SummaryCard({ label, totalCents, count, positive = false }: { label: string; totalCents: number; count: number; positive?: boolean }) {
  return (
    <div className="bg-[#4C1D80] rounded-[20px] p-4 mb-4 flex items-center justify-between">
      <div>
        <p className="text-[12px] text-white/70 font-medium mb-0.5">{label}</p>
        <p className="text-[28px] font-black text-white leading-none">{formatMoney(totalCents)}</p>
      </div>
      <div className="bg-white/15 rounded-full px-3 py-1.5">
        <p className="text-[12px] text-white font-semibold">
          {count} {count === 1 ? 'deuda' : 'deudas'}{positive ? ' a favor' : ''}
        </p>
      </div>
    </div>
  );
}

// ─── Tarjeta de deuda activa ───────────────────────────────────
function DebtCard({
  name,
  directionLabel,
  contextLine,
  amountCents,
  positive = false,
  onOpen,
  quickActionLabel,
  onQuickAction,
}: {
  name: string;
  directionLabel: string;
  contextLine: string;
  amountCents: number;
  positive?: boolean;
  onOpen: () => void;
  quickActionLabel: string;
  onQuickAction: () => void;
}) {
  return (
    <div className="bg-white rounded-[20px] shadow-sm border border-[#EBE3F5] overflow-hidden">
      {/* Zona superior: tap → detalle */}
      <button onClick={onOpen} className="w-full p-4 flex items-center gap-3 active:bg-gray-50 transition-colors text-left">
        <Avatar name={name} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-400 font-medium">{directionLabel}</p>
          <p className="text-[15px] font-bold text-[#1a1a1a] truncate">{name}</p>
          <p className="text-[12px] text-gray-400 truncate">{contextLine}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[18px] font-black ${positive ? 'text-[#3B6D11]' : 'text-[#1a1a1a]'}`}>
            {formatMoney(amountCents)}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c4c4c4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </button>
      {/* Acción rápida */}
      <div className="px-4 pb-3.5 flex justify-between items-center">
        <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">Pendiente</span>
        <button
          onClick={onQuickAction}
          className={`px-5 py-2 rounded-full text-[13px] font-bold active:scale-95 transition-transform ${
            quickActionLabel === 'Pagar' ? 'bg-[#4C1D80] text-white' : 'bg-[#F8F5FB] text-[#4C1D80]'
          }`}
        >
          {quickActionLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Item del historial ────────────────────────────────────────
function HistoryItem({ debt, userId, onOpen }: { debt: Debt; userId: string; onOpen: () => void }) {
  const isDebtor = debt.debtor_id === userId;
  const isPaid = debt.status === 'paid';
  const resolvedAt = debt.paid_at || debt.forgiven_at || debt.created_at;

  const title = isPaid
    ? (isDebtor ? `Pagaste a ${debt.creditor_name}` : `${debt.debtor_name} te pagó`)
    : (isDebtor ? `${debt.creditor_name} te perdonó` : `Perdonaste a ${debt.debtor_name}`);

  const inflow = isPaid && !isDebtor;

  return (
    <button onClick={onOpen} className="w-full bg-white p-4 rounded-[16px] border border-gray-100 flex items-center gap-3 active:bg-gray-50 transition-colors text-left">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isPaid ? 'bg-[#EAF3DE]' : 'bg-gray-100'}`}>
        {isPaid ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B6D11" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <span className="text-[14px]">🤍</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#1a1a1a] truncate">{title}</p>
        <p className="text-[12px] text-gray-400">{relativeDate(resolvedAt)}</p>
      </div>
      <span className={`font-bold text-[14px] shrink-0 ${
        !isPaid ? 'text-gray-400 line-through' : inflow ? 'text-[#3B6D11]' : 'text-[#1a1a1a]'
      }`}>
        {inflow ? '+' : ''}{formatMoney(debt.amount_cents)}
      </span>
    </button>
  );
}

// ─── Estado vacío ──────────────────────────────────────────────
function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center mt-14 px-8">
      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100">
        <span className="text-[28px]">{emoji}</span>
      </div>
      <p className="text-[16px] font-bold text-[#1a1a1a] mb-1">{title}</p>
      <p className="text-[13px] text-gray-400 text-center">{subtitle}</p>
    </div>
  );
}

// ─── Sheet de detalle de una deuda ─────────────────────────────
function DebtDetailSheet({
  debt,
  userId,
  roomName,
  onClose,
  onPay,
  onForgive,
  onRemind,
}: {
  debt: Debt;
  userId: string;
  roomName: string;
  onClose: () => void;
  onPay: () => void;
  onForgive: () => void;
  onRemind: () => void;
}) {
  const isDebtor = debt.debtor_id === userId;
  const otherName = isDebtor ? debt.creditor_name : debt.debtor_name;
  const isActive = debt.status === 'active';
  const isPaid = debt.status === 'paid';

  const statusBadge = isActive
    ? { text: 'Pendiente de pago', cls: 'bg-amber-50 text-amber-600' }
    : isPaid
      ? { text: 'Pagada', cls: 'bg-[#EAF3DE] text-[#3B6D11]' }
      : { text: 'Perdonada', cls: 'bg-gray-100 text-gray-500' };

  return (
    <>
      <div className="absolute inset-0 bg-black/40 z-40 md:rounded-[43px]" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] md:rounded-b-[43px] z-50 flex flex-col max-h-[88%] animate-slideUp overflow-hidden">
        {/* Handle + cerrar */}
        <div className="flex flex-col items-center pt-3 pb-2 shrink-0 relative">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
          <button
            onClick={onClose}
            className="absolute right-5 top-4 w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-500 rounded-full active:scale-95 text-[18px]"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-6 pb-2">
          {/* Persona + dirección */}
          <div className="flex flex-col items-center mt-2 mb-4">
            <Avatar name={otherName} size={64} />
            <p className="text-[13px] text-gray-400 mt-3">{isDebtor ? 'Le debes a' : 'Te debe'}</p>
            <p className="text-[19px] font-bold text-[#1a1a1a]">{otherName}</p>
            <p className={`text-[34px] font-black leading-tight mt-1 ${!isDebtor && isActive ? 'text-[#3B6D11]' : 'text-[#1a1a1a]'}`}>
              {formatMoney(debt.amount_cents)}
            </p>
            <span className={`text-[12px] font-semibold px-3 py-1 rounded-full mt-2 ${statusBadge.cls}`}>
              {statusBadge.text}
            </span>
          </div>

          {/* Detalles */}
          <div className="bg-[#F8F8FA] rounded-2xl p-4 space-y-3 mb-4">
            <DetailRow label="Origen" value={roomName} />
            <DetailRow label="Fecha del préstamo" value={fullDate(debt.created_at)} />
            {debt.paid_at && <DetailRow label="Pagada el" value={fullDate(debt.paid_at)} />}
            {debt.forgiven_at && <DetailRow label="Perdonada el" value={fullDate(debt.forgiven_at)} />}
            <DetailRow label="Referencia" value={debt.id.slice(0, 8).toUpperCase()} />
          </div>
        </div>

        {/* Acciones */}
        <div className="px-6 pb-6 pt-1 shrink-0 space-y-2.5">
          {isActive && isDebtor && (
            <button
              onClick={onPay}
              className="w-full py-4 bg-[#4C1D80] text-white rounded-[14px] font-bold text-[16px] active:scale-[0.98] transition-transform"
            >
              Pagar {formatMoney(debt.amount_cents)}
            </button>
          )}
          {isActive && !isDebtor && (
            <>
              <button
                onClick={onRemind}
                className="w-full py-4 bg-[#4C1D80] text-white rounded-[14px] font-bold text-[16px] active:scale-[0.98] transition-transform"
              >
                Enviar recordatorio
              </button>
              <button
                onClick={onForgive}
                className="w-full py-3.5 bg-white border border-[#FCEBEB] text-[#A32D2D] rounded-[14px] font-bold text-[15px] active:scale-[0.98] transition-transform"
              >
                Perdonar deuda
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-[13px] text-gray-400 shrink-0">{label}</span>
      <span className="text-[13px] font-semibold text-[#1a1a1a] text-right">{value}</span>
    </div>
  );
}

// ─── Sheet de confirmación (doble aceptación) ──────────────────
function ConfirmSheet({
  action,
  balance,
  processing,
  onCancel,
  onConfirm,
}: {
  action: NonNullable<ConfirmAction>;
  balance: number;
  processing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { debt } = action;
  const isPay = action.type === 'pay';
  const insufficient = isPay && balance < debt.amount_cents;
  const balanceAfter = balance - debt.amount_cents;

  return (
    <>
      <div className="absolute inset-0 bg-black/50 z-[55] md:rounded-[43px]" onClick={() => !processing && onCancel()} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] md:rounded-b-[43px] z-[60] animate-slideUp overflow-hidden">
        <div className="flex flex-col items-center pt-3 px-6 pb-6">
          <div className="w-10 h-1 bg-gray-200 rounded-full mb-5" />

          {isPay ? (
            <>
              <h3 className="text-[19px] font-bold text-[#1a1a1a] mb-4">Confirmar pago</h3>
              <Avatar name={debt.creditor_name} size={52} />
              <p className="text-[13px] text-gray-400 mt-2">Para</p>
              <p className="text-[16px] font-bold text-[#1a1a1a]">{debt.creditor_name}</p>
              <p className="text-[36px] font-black text-[#1a1a1a] mt-1 mb-4">{formatMoney(debt.amount_cents)}</p>

              {/* Impacto en el saldo: transparencia total antes de confirmar */}
              <div className="w-full bg-[#F8F8FA] rounded-2xl p-4 space-y-2.5 mb-4">
                <div className="flex justify-between">
                  <span className="text-[13px] text-gray-400">Saldo disponible</span>
                  <span className="text-[13px] font-semibold text-[#1a1a1a]">{formatMoney(balance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[13px] text-gray-400">Saldo después del pago</span>
                  <span className={`text-[13px] font-bold ${insufficient ? 'text-[#A32D2D]' : 'text-[#3B6D11]'}`}>
                    {insufficient ? '—' : formatMoney(balanceAfter)}
                  </span>
                </div>
              </div>

              {insufficient && (
                <div className="w-full bg-[#FCEBEB] rounded-xl px-4 py-3 mb-4">
                  <p className="text-[13px] text-[#A32D2D] font-semibold text-center">
                    Te faltan {formatMoney(debt.amount_cents - balance)} para pagar. Recarga desde tu cuenta principal.
                  </p>
                </div>
              )}

              <button
                onClick={onConfirm}
                disabled={insufficient || processing}
                className={`w-full py-4 rounded-[14px] font-bold text-[16px] transition-all flex items-center justify-center gap-2 ${
                  insufficient
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : processing
                      ? 'bg-[#4C1D80]/70 text-white cursor-wait'
                      : 'bg-[#4C1D80] text-white active:scale-[0.98]'
                }`}
              >
                {processing && (
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                )}
                {processing ? 'Pagando…' : `Pagar ${formatMoney(debt.amount_cents)}`}
              </button>
            </>
          ) : (
            <>
              <div className="w-14 h-14 bg-[#FCEBEB] rounded-full flex items-center justify-center mb-3">
                <span className="text-[26px]">🤍</span>
              </div>
              <h3 className="text-[19px] font-bold text-[#1a1a1a] mb-2 text-center">¿Perdonar esta deuda?</h3>
              <p className="text-[14px] text-gray-500 text-center mb-5 px-2">
                Le perdonarás <span className="font-bold text-[#1a1a1a]">{formatMoney(debt.amount_cents)}</span> a{' '}
                <span className="font-bold text-[#1a1a1a]">{debt.debtor_name}</span>. Esta acción no se puede deshacer.
              </p>
              <button
                onClick={onConfirm}
                disabled={processing}
                className={`w-full py-4 rounded-[14px] font-bold text-[16px] transition-all ${
                  processing ? 'bg-[#A32D2D]/70 cursor-wait' : 'bg-[#A32D2D] active:scale-[0.98]'
                } text-white`}
              >
                {processing ? 'Perdonando…' : 'Sí, perdonar deuda'}
              </button>
            </>
          )}

          <button
            onClick={onCancel}
            disabled={processing}
            className="w-full py-3.5 mt-2 rounded-[14px] font-bold text-[15px] text-gray-500 active:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}
