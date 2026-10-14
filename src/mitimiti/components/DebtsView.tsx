// ─── DebtsView: Mis deudas, agrupadas por persona ────────────
//
// Qué cambió respecto de la versión anterior y por qué:
//  • Una fila por PERSONA (no por sala): "Diego · $22,18" aunque venga de dos
//    salas. Pagar o recordar actúa sobre todo lo de esa persona.
//  • El resumen ES la navegación: dos tarjetas "Debes" / "Te deben" con su
//    total, en vez de pestañas + una tarjeta morada igual para ambos casos.
//  • Fuera el ruido repetido en cada tarjeta ("Te debe", "Pendiente"): en
//    esta lista todo está pendiente por definición.
//  • "Recordar" ahora hace algo: abre WhatsApp con un mensaje amable y el
//    link para pagar en un toque (antes solo mostraba un aviso y no llegaba
//    nada a nadie). Queda marcado "Recordado hoy" para no insistir de más.
//  • "Ya me pagó": para cuando te pagaron en efectivo u otro medio. Antes la
//    única forma de cerrar esa deuda era "Perdonar", que no es lo que pasó.
//  • Pagar sin saldo suficiente ofrece "Recargar $10 y pagar" en un toque.
//  • Fechas sin abreviaturas ambiguas ("11 de agosto", no "11 ago").
import { useState, useEffect, useMemo } from 'react';
import { useDebts, wasMarkedPaidByMe } from '../useDebts';
import { useBalance } from '../useBalance';
import { formatMoney, getUserProfile, relativeDate, longDate, daysSince } from '../utils';
import { getRoomNames } from '../supabase';
import { trackEvent } from '../analytics';
import { groupDebtsByPerson, type PersonDebts } from '../debtGroups';
import { openWhatsApp, reminderMessage } from '../share';
import type { Debt } from '../types';
import BottomSheet, { SheetCloseButton } from './BottomSheet';
import Avatar from './Avatar';
import PayDebtSheet from './PayDebtSheet';

type Tab = 'owe' | 'owed';
type PendingAction = { type: 'pay' | 'markPaid' | 'forgive'; personId: string; direction: Tab } | null;

function localDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const remindedKey = (userId: string, personId: string) => `mitimiti_reminded_${userId}_${personId}`;

function loadRemindedToday(userId: string): Set<string> {
  const prefix = remindedKey(userId, '');
  const today = localDateKey();
  const ids = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix) && localStorage.getItem(key) === today) {
      ids.add(key.slice(prefix.length));
    }
  }
  return ids;
}

function sinceLabel(iso: string): string {
  const days = daysSince(iso);
  if (days <= 0) return 'Desde hoy';
  if (days === 1) return 'Desde ayer';
  if (days < 28) return `Desde ${relativeDate(iso).toLowerCase()}`;
  return `Desde el ${relativeDate(iso)}`;
}

export default function DebtsView({ initialTab, onBack }: { initialTab?: Tab; onBack: () => void }) {
  const { debtsIOwe, debtsOwedToMe, history, isLoading, error, settleDebts, markDebtsPaid, forgiveDebts } = useDebts();
  const { balance, deduct, add } = useBalance();
  const profile = useMemo(() => getUserProfile(), []);
  const userId = profile?.userId || '';

  const oweGroups = groupDebtsByPerson(debtsIOwe, userId);
  const owedGroups = groupDebtsByPerson(debtsOwedToMe, userId);

  // Si el usuario no eligió pestaña, se abre donde hay algo que hacer.
  const [tabChoice, setTabChoice] = useState<Tab | null>(initialTab ?? null);
  const tab: Tab = tabChoice ?? (oweGroups.length === 0 && owedGroups.length > 0 ? 'owed' : 'owe');
  const [showHistory, setShowHistory] = useState(false);
  const [detailOf, setDetailOf] = useState<{ personId: string; direction: Tab } | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [roomNames, setRoomNames] = useState<Record<string, string>>({});
  const [remindedIds, setRemindedIds] = useState<Set<string>>(() => loadRemindedToday(userId));

  useEffect(() => {
    trackEvent('DEBTS_VIEW_OPENED', undefined, userId);
  }, [userId]);

  // Nombres de las salas de origen (contexto clave de cada deuda)
  const roomIdsKey = [...new Set([...debtsIOwe, ...debtsOwedToMe, ...history].map(d => d.room_id))].sort().join(',');
  useEffect(() => {
    if (!roomIdsKey) return;
    let alive = true;
    getRoomNames(roomIdsKey.split(','))
      .then(names => { if (alive) setRoomNames(names); })
      .catch(() => {});
    return () => { alive = false; };
  }, [roomIdsKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const findGroup = (personId: string, direction: Tab) =>
    (direction === 'owe' ? oweGroups : owedGroups).find(g => g.personId === personId) || null;
  // Se deriva de los datos vivos: si la deuda se paga (aquí o en otro
  // teléfono), la hoja se cierra sola en vez de mostrar algo viejo.
  const detail = detailOf ? findGroup(detailOf.personId, detailOf.direction) : null;
  const pendingGroup = pending ? findGroup(pending.personId, pending.direction) : null;

  const roomNameOf = (debt: Debt) => roomNames[debt.room_id] || 'Sala MitiMiti';
  const roomsOf = (g: PersonDebts) => [...new Set(g.debts.map(roomNameOf))];

  const totalOwe = oweGroups.reduce((acc, g) => acc + g.totalCents, 0);
  const totalOwed = owedGroups.reduce((acc, g) => acc + g.totalCents, 0);
  const groups = tab === 'owe' ? oweGroups : owedGroups;

  // ─── Acciones ───────────────────────────────────────────
  const finish = (message: string) => {
    setPending(null);
    setDetailOf(null);
    setToast(message);
  };

  const remind = (g: PersonDebts) => {
    openWhatsApp(reminderMessage(g.name, g.totalCents, roomsOf(g)));
    localStorage.setItem(remindedKey(userId, g.personId), localDateKey());
    setRemindedIds(prev => new Set(prev).add(g.personId));
    trackEvent('DEBT_REMINDER_SENT', g.debts[0]?.room_id, userId, {
      debtorId: g.personId,
      amountCents: g.totalCents,
      channel: 'whatsapp',
    });
  };

  const pay = async (g: PersonDebts, topUpCents: number) => {
    setProcessing(true);
    try {
      if (topUpCents > 0) add(topUpCents);
      const ok = await settleDebts(g.debts.map(d => d.id));
      if (!ok) return;
      deduct(g.totalCents);
      trackEvent('DEBT_PAID', g.debts[0]?.room_id, userId, {
        creditorId: g.personId,
        amountCents: g.totalCents,
        debts: g.debts.length,
        topUpCents,
      });
      finish(
        topUpCents > 0
          ? `Recargaste ${formatMoney(topUpCents)} y le pagaste ${formatMoney(g.totalCents)} a ${g.name}`
          : `Le pagaste ${formatMoney(g.totalCents)} a ${g.name}`,
      );
    } finally {
      setProcessing(false);
    }
  };

  const markPaid = async (g: PersonDebts) => {
    setProcessing(true);
    try {
      const ok = await markDebtsPaid(g.debts.map(d => d.id));
      if (!ok) return;
      trackEvent('DEBT_MARKED_PAID', g.debts[0]?.room_id, userId, { debtorId: g.personId, amountCents: g.totalCents });
      finish(`Listo: anotamos que ${g.name} ya te pagó`);
    } finally {
      setProcessing(false);
    }
  };

  const forgive = async (g: PersonDebts) => {
    setProcessing(true);
    try {
      const ok = await forgiveDebts(g.debts.map(d => d.id));
      if (!ok) return;
      trackEvent('DEBT_FORGIVEN', g.debts[0]?.room_id, userId, { debtorId: g.personId, amountCents: g.totalCents });
      finish(`Perdonaste a ${g.name}: ya no te debe nada`);
    } finally {
      setProcessing(false);
    }
  };

  const openDetail = (g: PersonDebts) => {
    trackEvent('DEBT_DETAIL_OPENED', g.debts[0]?.room_id, userId, { personId: g.personId });
    setDetailOf({ personId: g.personId, direction: g.direction });
  };

  return (
    <div className="flex flex-col flex-1 bg-[#F5F4F8] h-full relative">
      {/* Header */}
      <div className="bg-white flex items-center px-5 pt-14 pb-4 shrink-0 relative">
        <button
          onClick={showHistory ? () => setShowHistory(false) : onBack}
          aria-label="Volver"
          className="absolute left-4 p-1"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-[17px] font-bold text-[#1a1a1a] w-full text-center">
          {showHistory ? 'Historial' : 'Mis deudas'}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {showHistory ? (
          <HistoryList history={history} userId={userId} roomNameOf={roomNameOf} />
        ) : (
          <>
            {/* Resumen = pestañas */}
            <div className="grid grid-cols-2 gap-3 px-5 pt-4" role="tablist">
              <SummaryTile
                active={tab === 'owe'}
                label="Debes"
                totalCents={totalOwe}
                caption={oweGroups.length === 0 ? 'Estás al día' : `A ${peopleLabel(oweGroups.length)}`}
                tone="owe"
                onClick={() => setTabChoice('owe')}
              />
              <SummaryTile
                active={tab === 'owed'}
                label="Te deben"
                totalCents={totalOwed}
                caption={owedGroups.length === 0 ? 'Nadie te debe' : peopleLabel(owedGroups.length)}
                tone="owed"
                onClick={() => setTabChoice('owed')}
              />
            </div>

            <div className="px-5 pt-4 pb-8">
              {isLoading ? (
                <div className="space-y-3">
                  {[0, 1].map(i => (
                    <div key={i} className="bg-white rounded-[18px] h-[76px] animate-pulse border border-gray-100" />
                  ))}
                </div>
              ) : groups.length === 0 ? (
                tab === 'owe' ? (
                  <EmptyState emoji="🎉" title="Estás al día" subtitle="No le debes nada a nadie. Si alguna vez te falta saldo en una sala, aquí verás a quién le debes." />
                ) : (
                  <EmptyState emoji="🤝" title="Nadie te debe" subtitle="Cuando le prestes a alguien en una sala, aparecerá aquí." />
                )
              ) : (
                <div className="space-y-3">
                  {groups.map(g => (
                    <DebtRow
                      key={g.personId}
                      group={g}
                      roomLabel={roomsOf(g)[0]}
                      reminded={remindedIds.has(g.personId)}
                      onOpen={() => openDetail(g)}
                      onAction={() =>
                        g.direction === 'owe'
                          ? setPending({ type: 'pay', personId: g.personId, direction: g.direction })
                          : remind(g)
                      }
                    />
                  ))}
                </div>
              )}

              {!isLoading && history.length > 0 && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="w-full mt-5 py-3 rounded-[14px] text-[14px] font-semibold text-[#4C1D80] active:bg-white/60"
                >
                  Ver historial ({history.length})
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Detalle por persona */}
      {detail && !pending && (
        <PersonDebtSheet
          group={detail}
          roomNameOf={roomNameOf}
          remindedToday={remindedIds.has(detail.personId)}
          onClose={() => setDetailOf(null)}
          onPay={() => setPending({ type: 'pay', personId: detail.personId, direction: detail.direction })}
          onRemind={() => remind(detail)}
          onMarkPaid={() => setPending({ type: 'markPaid', personId: detail.personId, direction: detail.direction })}
          onForgive={() => setPending({ type: 'forgive', personId: detail.personId, direction: detail.direction })}
        />
      )}

      {/* Confirmaciones (las acciones con dinero siempre pasan por aquí) */}
      {pending && pendingGroup && pending.type === 'pay' && (
        <PayDebtSheet
          creditorName={pendingGroup.name}
          debts={pendingGroup.debts}
          roomNames={roomNames}
          balanceCents={balance}
          busy={processing}
          onClose={() => setPending(null)}
          onConfirm={topUpCents => pay(pendingGroup, topUpCents)}
        />
      )}
      {pending && pendingGroup && pending.type !== 'pay' && (
        <ConfirmSheet
          type={pending.type}
          group={pendingGroup}
          busy={processing}
          onCancel={() => setPending(null)}
          onConfirm={() => (pending.type === 'forgive' ? forgive(pendingGroup) : markPaid(pendingGroup))}
        />
      )}

      {/* Aviso de éxito */}
      {toast && (
        <div className="absolute top-16 left-5 right-5 z-[90] bg-[#EAF3DE] border border-[#3B6D11]/20 rounded-2xl px-4 py-3 flex items-center gap-2 shadow-lg animate-fadeIn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B6D11" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p className="text-[13px] font-semibold text-[#3B6D11]">{toast}</p>
        </div>
      )}

      {error && !toast && (
        <div className="absolute top-16 left-5 right-5 z-[90] bg-[#FCEBEB] rounded-2xl px-4 py-3 shadow-lg animate-fadeIn">
          <p className="text-[13px] font-semibold text-[#A32D2D] text-center">{error}</p>
        </div>
      )}
    </div>
  );
}

function peopleLabel(n: number): string {
  return n === 1 ? '1 persona' : `${n} personas`;
}

// ─── Resumen que funciona como pestaña ────────────────────────
function SummaryTile({
  active,
  label,
  totalCents,
  caption,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  totalCents: number;
  caption: string;
  tone: Tab;
  onClick: () => void;
}) {
  const activeBorder = tone === 'owed' ? 'border-[#3B6D11]' : 'border-[#4C1D80]';
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`text-left rounded-[20px] p-4 border-2 transition-all active:scale-[0.98] ${
        active ? `bg-white ${activeBorder} shadow-[0_6px_18px_rgba(76,29,128,0.10)]` : 'bg-white/60 border-transparent'
      }`}
    >
      <p className={`text-[13px] font-semibold ${active ? 'text-[#1a1a1a]' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-[24px] font-black leading-tight tabular-nums ${tone === 'owed' ? 'text-[#3B6D11]' : 'text-[#1a1a1a]'}`}>
        {formatMoney(totalCents)}
      </p>
      <p className="text-[12px] text-gray-500 mt-0.5">{caption}</p>
    </button>
  );
}

// ─── Fila por persona ─────────────────────────────────────────
function DebtRow({
  group,
  roomLabel,
  reminded,
  onOpen,
  onAction,
}: {
  group: PersonDebts;
  roomLabel: string;
  reminded: boolean;
  onOpen: () => void;
  onAction: () => void;
}) {
  const owed = group.direction === 'owed';
  const stale = owed && daysSince(group.oldestAt) >= 7;
  const context = group.debts.length === 1
    ? `${roomLabel} · ${relativeDate(group.oldestAt)}`
    : `${group.debts.length} salas · ${relativeDate(group.oldestAt)}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpen(); }}
      className="bg-white rounded-[18px] border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3.5 flex items-center gap-3 active:bg-gray-50 transition-colors cursor-pointer"
    >
      <Avatar name={group.name} size={44} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[16px] font-bold text-[#1a1a1a] truncate">{group.name}</p>
          <p className={`text-[17px] font-black tabular-nums shrink-0 ${owed ? 'text-[#3B6D11]' : 'text-[#1a1a1a]'}`}>
            {formatMoney(group.totalCents)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className={`text-[13px] truncate ${stale ? 'text-amber-700 font-medium' : 'text-gray-500'}`}>{context}</p>
          {!owed ? (
            <button
              onClick={e => { e.stopPropagation(); onAction(); }}
              className="px-4 py-1.5 rounded-full bg-[#4C1D80] text-white text-[13px] font-bold active:scale-95 transition-transform shrink-0"
            >
              Pagar
            </button>
          ) : reminded ? (
            <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 text-[12px] font-semibold shrink-0">
              ✓ Recordado hoy
            </span>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onAction(); }}
              className="px-3.5 py-1.5 rounded-full bg-[#F3EDFB] text-[#4C1D80] text-[13px] font-bold flex items-center gap-1.5 active:scale-95 transition-transform shrink-0"
            >
              <ChatIcon size={14} />
              Recordar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Detalle de lo que hay con una persona ────────────────────
function PersonDebtSheet({
  group,
  roomNameOf,
  remindedToday,
  onClose,
  onPay,
  onRemind,
  onMarkPaid,
  onForgive,
}: {
  group: PersonDebts;
  roomNameOf: (debt: Debt) => string;
  remindedToday: boolean;
  onClose: () => void;
  onPay: () => void;
  onRemind: () => void;
  onMarkPaid: () => void;
  onForgive: () => void;
}) {
  const owed = group.direction === 'owed';
  const stale = daysSince(group.oldestAt) >= 7;

  return (
    <BottomSheet onClose={onClose} label={owed ? `${group.name} te debe` : `Le debes a ${group.name}`}>
      {/* Flotando sobre el contenido: antes el bloque del avatar lo tapaba
          y el toque en la ✕ caía en otra cosa. */}
      <div className="absolute right-4 top-4 z-10">
        <SheetCloseButton onClick={onClose} />
      </div>

      <div className="overflow-y-auto px-6 pb-2 pt-2">
        <div className="flex flex-col items-center mb-4">
          <Avatar name={group.name} size={64} />
          <p className="text-[14px] text-gray-500 mt-3">{owed ? `${group.name} te debe` : `Le debes a ${group.name}`}</p>
          <p className={`text-[36px] font-black leading-tight tabular-nums ${owed ? 'text-[#3B6D11]' : 'text-[#1a1a1a]'}`}>
            {formatMoney(group.totalCents)}
          </p>
          <p className={`text-[13px] mt-0.5 ${stale ? 'text-amber-700 font-semibold' : 'text-gray-500'}`}>
            {sinceLabel(group.oldestAt)}
          </p>
        </div>

        <div className="bg-[#F8F8FA] rounded-2xl p-4 space-y-3 mb-4">
          {group.debts.map(d => (
            <div key={d.id} className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[#1a1a1a] truncate">{roomNameOf(d)}</p>
                <p className="text-[12px] text-gray-500">{longDate(d.created_at)}</p>
              </div>
              <span className="text-[14px] font-bold text-[#1a1a1a] tabular-nums shrink-0">{formatMoney(d.amount_cents)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-1 shrink-0 space-y-2.5">
        {owed ? (
          <>
            <button
              onClick={onRemind}
              className="w-full py-4 bg-[#4C1D80] text-white rounded-[14px] font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <ChatIcon size={18} />
              {remindedToday ? 'Recordar otra vez por WhatsApp' : 'Recordar por WhatsApp'}
            </button>
            <button
              onClick={onMarkPaid}
              className="w-full py-3 bg-white border-2 border-[#EBE3F5] rounded-[14px] active:scale-[0.98] transition-transform"
            >
              <span className="block text-[15px] font-bold text-[#4C1D80]">Ya me pagó</span>
              <span className="block text-[12px] text-gray-500">En efectivo o por otro medio</span>
            </button>
            <button
              onClick={onForgive}
              className="w-full py-2.5 text-[14px] font-semibold text-[#A32D2D] active:opacity-70"
            >
              Perdonar deuda
            </button>
          </>
        ) : (
          <button
            onClick={onPay}
            className="w-full py-4 bg-[#4C1D80] text-white rounded-[14px] font-bold text-[16px] active:scale-[0.98] transition-transform"
          >
            Pagar {formatMoney(group.totalCents)}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

// ─── Confirmar "Ya me pagó" / "Perdonar" ─────────────────────
function ConfirmSheet({
  type,
  group,
  busy,
  onCancel,
  onConfirm,
}: {
  type: 'markPaid' | 'forgive';
  group: PersonDebts;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isForgive = type === 'forgive';
  const amount = formatMoney(group.totalCents);

  return (
    <BottomSheet onClose={onCancel} dismissible={!busy}>
      <div className="flex flex-col items-center px-6 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${isForgive ? 'bg-[#FCEBEB]' : 'bg-[#EAF3DE]'}`}>
          <span className="text-[26px]" aria-hidden="true">{isForgive ? '🤍' : '💵'}</span>
        </div>
        <h3 className="text-[19px] font-bold text-[#1a1a1a]">
          {isForgive ? `¿Perdonarle la deuda a ${group.name}?` : `¿${group.name} ya te pagó ${amount}?`}
        </h3>
        <p className="text-[14px] text-gray-500 mt-2 mb-5 px-2">
          {isForgive
            ? `${group.name} ya no te deberá ${amount}. Esto no se puede deshacer.`
            : 'La marcaremos como pagada. No mueve dinero en Deuna: úsalo si te pagó en efectivo o por otro medio.'}
        </p>
        <button
          onClick={onConfirm}
          disabled={busy}
          className={`w-full py-4 rounded-[14px] font-bold text-[16px] text-white transition-all ${
            isForgive ? 'bg-[#A32D2D]' : 'bg-[#4C1D80]'
          } ${busy ? 'opacity-70 cursor-wait' : 'active:scale-[0.98]'}`}
        >
          {busy ? 'Guardando…' : isForgive ? 'Sí, perdonar' : 'Sí, ya me pagó'}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="w-full py-3 mt-1.5 rounded-[14px] font-bold text-[15px] text-gray-500 active:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </BottomSheet>
  );
}

// ─── Historial ────────────────────────────────────────────────
function HistoryList({ history, userId, roomNameOf }: { history: Debt[]; userId: string; roomNameOf: (d: Debt) => string }) {
  if (history.length === 0) {
    return <EmptyState emoji="🗂️" title="Sin movimientos aún" subtitle="Aquí verás las deudas pagadas o perdonadas." />;
  }
  return (
    <div className="px-5 py-4 space-y-2.5">
      {history.map(debt => (
        <HistoryItem key={debt.id} debt={debt} userId={userId} roomName={roomNameOf(debt)} />
      ))}
    </div>
  );
}

function HistoryItem({ debt, userId, roomName }: { debt: Debt; userId: string; roomName: string }) {
  const isDebtor = debt.debtor_id === userId;
  const isPaid = debt.status === 'paid';
  const outsideDeuna = isPaid && !isDebtor && wasMarkedPaidByMe(debt.id);
  const resolvedAt = debt.paid_at || debt.forgiven_at || debt.created_at;

  const title = isPaid
    ? isDebtor
      ? `Le pagaste a ${debt.creditor_name}`
      : outsideDeuna ? `${debt.debtor_name} te pagó por fuera` : `${debt.debtor_name} te pagó`
    : isDebtor ? `${debt.creditor_name} te perdonó` : `Perdonaste a ${debt.debtor_name}`;

  const inflow = isPaid && !isDebtor && !outsideDeuna;

  return (
    <div className="w-full bg-white p-4 rounded-[16px] border border-gray-100 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isPaid ? 'bg-[#EAF3DE]' : 'bg-gray-100'}`}>
        {isPaid ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B6D11" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <span className="text-[14px]" aria-hidden="true">🤍</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#1a1a1a] truncate">{title}</p>
        <p className="text-[12px] text-gray-500 truncate">{roomName} · {relativeDate(resolvedAt)}</p>
      </div>
      <span className={`font-bold text-[14px] shrink-0 tabular-nums ${
        !isPaid ? 'text-gray-400 line-through' : inflow ? 'text-[#3B6D11]' : 'text-[#1a1a1a]'
      }`}>
        {inflow ? '+' : ''}{formatMoney(debt.amount_cents)}
      </span>
    </div>
  );
}

// ─── Estado vacío ──────────────────────────────────────────────
function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center mt-10 px-6">
      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100">
        <span className="text-[28px]" aria-hidden="true">{emoji}</span>
      </div>
      <p className="text-[16px] font-bold text-[#1a1a1a] mb-1">{title}</p>
      <p className="text-[14px] text-gray-500 text-center leading-snug">{subtitle}</p>
    </div>
  );
}

function ChatIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}
