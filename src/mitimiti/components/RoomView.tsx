// ─── RoomView: Sala MitiMiti (Host + Participante) ───────────
//
// Principios de esta pantalla:
//  • Una sola cosa por hacer a la vez: abajo siempre hay UN estado claro
//    ("Esperando a que Pedro divida…") y la acción que toca, nunca un botón
//    gris deshabilitado haciendo de cartel.
//  • Partes iguales en UN toque ("Dividir igual entre 3"); "Montos
//    diferentes" queda a mano pero no estorba al 90% de los casos.
//  • El host acepta su propia parte en el mismo toque en que divide (si su
//    saldo alcanza): acaba de poner los montos, preguntarle "¿Aceptas?" era
//    un paso de más.
//  • El vencimiento lo aplica cualquiera que esté en la sala, no solo el
//    host mirando la pantalla.
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import { formatMoney, dividirMonto, getUserProfile, roomEmoji, topUpAmountFor, isRoomOpen } from '../utils';
import { groupDebtsByPerson } from '../debtGroups';
import { openWhatsApp, inviteMessage } from '../share';
import { getRoomNames } from '../supabase';
import { useRoom } from '../useRoom';
import { useBalance } from '../useBalance';
import { useDebts } from '../useDebts';
import { trackEvent } from '../analytics';
import QRInvite from './QRInvite';
import ParticipantCard from './ParticipantCard';
import RoomTimer from './RoomTimer';
import ProcessingView from './ProcessingView';
import SuccessView from './SuccessView';
import ErrorView from './ErrorView';
import RoomClosedView from './RoomClosedView';
import SplitEditorSheet from './SplitEditorSheet';
import InsufficientFundsModal from './InsufficientFundsModal';
import LoanRequestCard from './LoanRequestCard';
import LoanWaitingView from './LoanWaitingView';
import DebtBanner from './DebtBanner';
import PayDebtSheet from './PayDebtSheet';
import BottomSheet from './BottomSheet';

interface RoomViewProps {
  roomId: string;
  onBack: () => void;
  onExit: () => void;
  onRecreate: (name: string, totalCents: number) => void;
  onOpenDebts: (tab: 'owe' | 'owed') => void;
}

const people = (n: number) => (n === 1 ? '1 persona' : `${n} personas`);

export default function RoomView({ roomId, onBack, onExit, onRecreate, onOpenDebts }: RoomViewProps) {
  const {
    room,
    participants,
    myParticipant,
    isHost,
    isLoading,
    error,
    lockRoom,
    confirmPayment,
    executePayment,
    leaveRoom,
    cancelRoom,
    expireRoom,
    requestLoan,
    lendMoney,
    debts,
    clearError,
  } = useRoom(roomId);

  const { balance, deduct, add } = useBalance();
  const { debtsIOwe, settleDebts } = useDebts();

  const [splitSheet, setSplitSheet] = useState<'new' | 'correct' | null>(null);
  // Monto de mi parte cuando no me alcanza el saldo (abre las opciones).
  const [shortfallFor, setShortfallFor] = useState<number | null>(null);
  const [confirmSheet, setConfirmSheet] = useState<'cancel' | 'leave' | null>(null);
  const [payDebtOpen, setPayDebtOpen] = useState(false);
  const [debtRoomNames, setDebtRoomNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [expiredLocally, setExpiredLocally] = useState(false);
  const [toast, setToastState] = useState<{ text: string; kind: 'join' | 'info' } | null>(null);
  const setToast = (text: string | null, kind: 'join' | 'info' = 'info') =>
    setToastState(text ? { text, kind } : null);
  const [dismissedCreditors, setDismissedCreditors] = useState<Set<string>>(new Set());
  const known = useRef<{ ids: Set<string>; names: Map<string, string> } | null>(null);
  const lastMyAmount = useRef<number | null>(null);
  const payTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const profile = getUserProfile();
  const userId = profile?.userId || '';

  // Monto estimado por persona (live). Va memoizado porque dividirMonto
  // reparte el centavo sobrante al azar: sin esto se re-barajaba en cada
  // render y los "~$16,67" de la lista bailaban solos en pantalla.
  const hasRoom = room !== null;
  const totalWithTip = room ? room.total_cents + room.tip_cents : 0;
  const participantCount = participants.length;
  const estimatedAmounts = useMemo(
    () => (hasRoom && participantCount > 0 ? dividirMonto(totalWithTip, participantCount) : []),
    [hasRoom, totalWithTip, participantCount],
  );

  // Avisos de llegada y salida. El host casi siempre está mirando el QR
  // esperando a que la gente escanee: un cambio silencioso en la lista se le
  // pasa por completo. Y si alguien se va, todos deben saber por qué la
  // cuenta volvió a dividirse.
  useEffect(() => {
    if (participants.length === 0) return;

    const ids = new Set(participants.map(p => p.user_id));
    const names = new Map(participants.map(p => [p.user_id, p.display_name]));
    const prev = known.current;
    known.current = { ids, names };

    // Primera carga: solo tomamos la foto inicial, no anunciamos a nadie.
    if (prev === null) return;

    const arrived = participants.filter(p => !prev.ids.has(p.user_id) && p.user_id !== userId);
    const left = [...prev.ids].filter(id => !ids.has(id) && id !== userId);

    if (arrived.length === 1) {
      setToastState({ text: `${arrived[0].display_name} se unió`, kind: 'join' });
    } else if (arrived.length > 1) {
      setToastState({ text: `${arrived.length} personas se unieron`, kind: 'join' });
    } else if (left.length === 1) {
      setToastState({ text: `${prev.names.get(left[0]) ?? 'Alguien'} salió de la sala`, kind: 'info' });
    } else if (left.length > 1) {
      setToastState({ text: `${left.length} personas salieron de la sala`, kind: 'info' });
    }
  }, [participants, userId]);

  // Si el host corrige montos con la sala ya dividida, cada uno se entera de
  // cuánto le toca ahora (y vuelve a aceptar).
  const myAmount = myParticipant?.amount_cents ?? null;
  const hostName = room?.host_name ?? 'El anfitrión';
  useEffect(() => {
    const prev = lastMyAmount.current;
    lastMyAmount.current = myAmount;
    if (isHost || prev === null || myAmount === null || prev === myAmount) return;
    setToastState({ text: `${hostName} cambió los montos. Ahora te toca ${formatMoney(myAmount)}.`, kind: 'info' });
  }, [myAmount, isHost, hostName]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToastState(null), 3600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && room?.status === 'processing') {
        trackEvent(`VISIBILITY_HIDDEN_${room.status.toUpperCase()}`, room.id, userId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [room?.status, room?.id, userId]);

  // Vencimiento en CUALQUIER estado abierto y por cualquiera en la sala.
  // Antes solo pasaba en 'waiting' y solo si el host estaba mirando: por eso
  // salas como "Pizza" quedaban en 00:00 y "activas" para siempre.
  const roomStatus = room?.status;
  const handleExpired = useCallback(() => {
    if (!roomStatus || !isRoomOpen({ status: roomStatus })) return;
    setExpiredLocally(true);
    void expireRoom();
  }, [roomStatus, expireRoom]);

  // Deudas que tengo con alguien que está en esta sala (recordatorio en contexto)
  const roomCreditorGroups = groupDebtsByPerson(
    debtsIOwe.filter(d => participants.some(p => p.user_id === d.creditor_id)),
    userId,
  );
  const bannerGroup = roomCreditorGroups.find(g => !dismissedCreditors.has(g.personId)) ?? null;
  const bannerRoomIds = bannerGroup ? [...new Set(bannerGroup.debts.map(d => d.room_id))].sort().join(',') : '';

  useEffect(() => {
    if (!payDebtOpen || !bannerRoomIds) return;
    let alive = true;
    getRoomNames(bannerRoomIds.split(','))
      .then(names => { if (alive) setDebtRoomNames(names); })
      .catch(() => {});
    return () => { alive = false; };
  }, [payDebtOpen, bannerRoomIds]);

  // ─── Acciones ───────────────────────────────────────────

  // Dividir (o corregir) y, en el mismo toque, aceptar la parte del host.
  const runSplit = async (mode: 'equal' | 'custom', amounts?: { userId: string; amountCents: number }[]) => {
    if (busy) return;
    setBusy(true);
    try {
      const assigned = await lockRoom(mode, amounts);
      if (!assigned) return; // el error ya quedó en pantalla
      setSplitSheet(null);

      const mine = assigned.find(a => a.userId === userId)?.amountCents ?? 0;
      if (mine === 0) {
        setToast('Listo: cada uno ya puede aceptar su parte');
        return;
      }
      if (balance >= mine) {
        const ok = await confirmPayment(mine);
        if (ok) setToast('Listo: cada uno ya puede aceptar su parte');
      } else {
        setShortfallFor(mine);
      }
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!myParticipant || busy) return;
    const mine = myParticipant.amount_cents ?? 0;
    if (mine > balance) {
      setShortfallFor(mine);
      return;
    }
    setBusy(true);
    try {
      await confirmPayment(mine);
    } finally {
      setBusy(false);
    }
  };

  // Recarga simulada desde la cuenta principal + aceptar, en un toque.
  const topUpAndAccept = async (topUpCents: number, amountCents: number) => {
    setBusy(true);
    try {
      add(topUpCents);
      trackEvent('TOP_UP_IN_ROOM', roomId, userId, { topUpCents });
      const ok = await confirmPayment(amountCents);
      if (ok) {
        setShortfallFor(null);
        setToast(`Recargaste ${formatMoney(topUpCents)} y aceptaste tu parte`);
      }
    } finally {
      setBusy(false);
    }
  };

  const askForLoan = async (amountCents: number) => {
    setBusy(true);
    try {
      await requestLoan(Math.max(0, amountCents - balance));
      setShortfallFor(null);
    } finally {
      setBusy(false);
    }
  };

  const invite = () => {
    if (!room) return;
    trackEvent('INVITE_SHARED', room.id, userId, { channel: 'whatsapp' });
    openWhatsApp(inviteMessage(room));
  };

  const doCancel = async () => {
    setBusy(true);
    try {
      await cancelRoom();
      setConfirmSheet(null);
    } finally {
      setBusy(false);
    }
  };

  const doLeave = async () => {
    setBusy(true);
    try {
      await leaveRoom();
      onExit();
    } finally {
      setBusy(false);
    }
  };

  const payRoomDebt = async (topUpCents: number) => {
    if (!bannerGroup) return;
    setBusy(true);
    try {
      if (topUpCents > 0) add(topUpCents);
      const ok = await settleDebts(bannerGroup.debts.map(d => d.id));
      if (!ok) return;
      deduct(bannerGroup.totalCents);
      trackEvent('DEBT_PAID', roomId, userId, {
        creditorId: bannerGroup.personId,
        amountCents: bannerGroup.totalCents,
        from: 'room_banner',
        topUpCents,
      });
      setPayDebtOpen(false);
      setToast(`Le pagaste ${formatMoney(bannerGroup.totalCents)} a ${bannerGroup.name}`);
    } finally {
      setBusy(false);
    }
  };

  const pay = async (simulateFailure: boolean) => {
    if (paying) return;
    setPaying(true);
    try {
      await executePayment(simulateFailure);
    } finally {
      setPaying(false);
    }
  };

  // Mantener presionado 2 s "Pagar" simula un fallo (truco de demo). Con
  // pointer events: antes touch + mouse disparaban el pago dos veces en móvil.
  const onPayDown = () => {
    if (paying) return;
    longPressFired.current = false;
    payTimer.current = setTimeout(() => {
      payTimer.current = null;
      longPressFired.current = true;
      void pay(true);
    }, 2000);
  };
  const onPayUp = () => {
    if (!payTimer.current) return;
    clearTimeout(payTimer.current);
    payTimer.current = null;
    if (!longPressFired.current) void pay(false);
  };
  const onPayCancel = () => {
    if (payTimer.current) {
      clearTimeout(payTimer.current);
      payTimer.current = null;
    }
  };

  // ─── Estados especiales (pantalla completa) ─────────────

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1">
        <div className="mitimiti-spin w-8 h-8 border-3 border-gray-200 border-t-[#4C1D80] rounded-full" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 text-center">
        <p className="text-[18px] font-bold text-[#1a1a1a] mb-1">No encontramos esta sala</p>
        <p className="text-[14px] text-gray-500 mb-6">Puede que el enlace esté incompleto.</p>
        <button onClick={onBack} className="px-8 py-3 rounded-[14px] bg-gray-100 text-[#1a1a1a] text-[15px] font-bold">
          Volver al inicio
        </button>
      </div>
    );
  }

  if (room.status === 'processing') {
    return <ProcessingView />;
  }

  if (room.status === 'completed') {
    return (
      <SuccessView
        room={room}
        participants={participants}
        myUserId={userId}
        roomDebts={debts}
        onDone={onExit}
        onOpenDebts={onOpenDebts}
      />
    );
  }

  if (room.status === 'failed') {
    return (
      <ErrorView
        message={
          isHost
            ? error || 'El pago no se pudo completar.'
            : `El pago no se pudo completar. ${room.host_name} puede reintentarlo.`
        }
        isHost={isHost}
        busy={paying}
        onRetry={isHost ? () => pay(false) : undefined}
        onCancel={isHost ? cancelRoom : undefined}
        onBack={onExit}
      />
    );
  }

  if (room.status === 'cancelled' || (expiredLocally && isRoomOpen(room))) {
    return (
      <RoomClosedView
        room={room}
        isHost={isHost}
        expiredNow={expiredLocally}
        onExit={onExit}
        onRecreate={() => onRecreate(room.commerce_name, room.total_cents)}
      />
    );
  }

  // ─── Vista principal de la sala ─────────────────────────

  const isWaiting = room.status === 'waiting';
  const isLocked = room.status === 'locked';
  const isConfirming = room.status === 'confirming';
  const myStatus = myParticipant?.confirmation_status;
  const myShare = myParticipant?.amount_cents ?? 0;
  const confirmedCount = participants.filter(p => p.confirmation_status === 'confirmed').length;
  const pendingCount = participants.length - confirmedCount;
  const roomLoans = debts.filter(d => d.status === 'pending');
  const canCorrect = isHost && isLocked && roomLoans.length === 0;
  const myIndex = participants.findIndex(p => p.user_id === userId);
  const myEstimate = myIndex >= 0 ? estimatedAmounts[myIndex] ?? 0 : 0;

  // Cuánto puedo prestar de verdad: mi saldo, menos mi propia parte, menos
  // lo que YA presté en esta sala. Nunca debo comprometer mi parte.
  const myLentInRoom = roomLoans
    .filter(d => d.creditor_id === userId)
    .reduce((acc, d) => acc + d.amount_cents, 0);
  const mySpareCents = Math.max(0, balance - myShare - myLentInRoom);

  // Si estoy esperando un préstamo, también puedo resolverlo recargando.
  const myBorrowed = roomLoans
    .filter(d => d.debtor_id === userId)
    .reduce((acc, d) => acc + d.amount_cents, 0);
  const loanTopUp = topUpAmountFor(Math.max(0, myShare - myBorrowed - balance));

  const centsNote =
    room.split_mode === 'equal' && (isLocked || isConfirming) && participants.length > 0 &&
    (room.total_cents + room.tip_cents) % participants.length !== 0;

  const renderActions = (): ReactNode => {
    if (isHost) {
      if (isWaiting) {
        if (participants.length < 2) {
          return (
            <StatusNote
              icon="⏳"
              title="Esperando a que alguien se una"
              subtitle="Con al menos 2 personas ya puedes dividir."
            />
          );
        }
        return (
          <>
            <PrimaryButton onClick={() => runSplit('equal')} disabled={busy}>
              {busy ? 'Dividiendo…' : `Dividir igual entre ${participants.length}`}
            </PrimaryButton>
            <SecondaryButton onClick={() => setSplitSheet('new')} disabled={busy}>
              Montos diferentes
            </SecondaryButton>
          </>
        );
      }

      if (isConfirming) {
        return (
          <>
            <StatusNote tone="success" icon="🎉" title="¡Todos aceptaron!" subtitle="Paga y listo: a cada uno se le descuenta su parte." />
            <button
              onPointerDown={onPayDown}
              onPointerUp={onPayUp}
              onPointerLeave={onPayCancel}
              onPointerCancel={onPayCancel}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') void pay(false); }}
              onContextMenu={e => e.preventDefault()}
              disabled={paying}
              className="w-full py-4 rounded-[14px] text-[16px] font-bold bg-[#4C1D80] text-white active:scale-[0.98] transition-transform select-none touch-manipulation disabled:opacity-70"
            >
              {paying ? 'Pagando…' : `Pagar ${formatMoney(room.total_cents)}`}
            </button>
          </>
        );
      }
    }

    // ── Participante (y host en 'locked') ──
    if (isWaiting) {
      return (
        <>
          <StatusNote
            tone="brand"
            icon="⏳"
            title={`Esperando a que ${room.host_name} divida la cuenta`}
            subtitle={`Por ahora te tocaría ~${formatMoney(myEstimate)}`}
          />
          <TextButton onClick={doLeave} disabled={busy}>Salir de la sala</TextButton>
        </>
      );
    }

    if (isLocked && myStatus === 'pending') {
      return (
        <>
          {isHost && <StatusNote icon="👛" title="Falta que aceptes tu parte" subtitle="Los demás ya pueden aceptar la suya." />}
          <PrimaryButton onClick={accept} disabled={busy}>
            {busy ? 'Aceptando…' : `Acepto pagar ${formatMoney(myShare)}`}
          </PrimaryButton>
          {isHost
            ? canCorrect && <TextButton onClick={() => setSplitSheet('correct')} disabled={busy}>Corregir montos</TextButton>
            : <TextButton onClick={() => setConfirmSheet('leave')} disabled={busy}>Salir de la sala</TextButton>}
        </>
      );
    }

    if (isLocked && myStatus === 'requesting_loan') {
      return (
        <>
          {loanTopUp > 0 && (
            <SecondaryButton onClick={() => topUpAndAccept(loanTopUp, myShare)} disabled={busy}>
              {busy ? 'Recargando…' : `Mejor recargo ${formatMoney(loanTopUp)} y acepto`}
            </SecondaryButton>
          )}
          {!isHost && <TextButton onClick={() => setConfirmSheet('leave')} disabled={busy}>Salir de la sala</TextButton>}
        </>
      );
    }

    if (isLocked) {
      // Ya aceptaste: esperando a los demás.
      return (
        <>
          <StatusNote
            tone="success"
            icon="✓"
            title={myShare === 0 ? 'No te toca pagar nada 🎁' : `Aceptaste ${formatMoney(myShare)}`}
            subtitle={`Esperando a ${people(pendingCount)} · ${confirmedCount} de ${participants.length} listos`}
          />
          {canCorrect && (
            <TextButton onClick={() => setSplitSheet('correct')} disabled={busy}>Corregir montos</TextButton>
          )}
        </>
      );
    }

    // confirming, visto por un participante
    return (
      <StatusNote
        tone="success"
        icon="✓"
        title="Todos aceptaron"
        subtitle={`Esperando a que ${room.host_name} pague…`}
      />
    );
  };

  return (
    <div className="flex flex-col flex-1 relative min-h-0">
      {/* Aviso de llegadas/salidas/cambios. Puede ocupar dos líneas: lo
          importante suele ir al final ("…Ahora te toca $7,00"). */}
      {toast && (
        <div className="absolute top-[70px] left-0 right-0 z-40 flex justify-center px-5 pointer-events-none" role="status">
          <div className="mitimiti-fade-in-up bg-[#4C1D80] text-white text-[14px] font-bold px-4 py-2.5 rounded-[14px] shadow-lg flex items-center gap-2 max-w-full">
            {toast.kind === 'join' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
            <span className="leading-snug">{toast.text}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-2 shrink-0">
        <button onClick={onBack} aria-label="Volver al inicio" className="p-1 -ml-1 w-24 text-left">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-[17px] font-bold text-[#1a1a1a]">MitiMiti</h1>
        <div className="w-24 flex justify-end">
          {isHost && (isWaiting || isLocked || isConfirming) && (
            <button
              onClick={() => setConfirmSheet('cancel')}
              className="text-[13px] font-semibold text-[#A32D2D] py-1"
            >
              Cancelar sala
            </button>
          )}
        </div>
      </div>

      {/* Info de la sala */}
      <div className="mx-5 bg-[#F8F8FA] rounded-2xl px-4 py-3 flex items-center justify-between gap-3 border border-gray-100 shrink-0">
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-[#1a1a1a] truncate">
            {roomEmoji(room.commerce_name)} {room.commerce_name}
          </p>
          <p className="text-[12px] text-gray-500 truncate">{isHost ? 'Tu sala' : `Sala de ${room.host_name}`}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[26px] font-bold text-[#1a1a1a] leading-none tabular-nums">
            {formatMoney(room.total_cents)}
          </p>
          <RoomTimer expiresAt={room.expires_at} onExpired={handleExpired} />
        </div>
      </div>

      {bannerGroup && isWaiting && (
        <div className="mt-3 shrink-0">
          <DebtBanner
            creditorName={bannerGroup.name}
            debts={bannerGroup.debts}
            onPay={() => setPayDebtOpen(true)}
            onDismiss={() => setDismissedCreditors(prev => new Set(prev).add(bannerGroup.personId))}
          />
        </div>
      )}

      {/* Contenido central */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
        {/* QR + invitación (host, mientras la gente va llegando) */}
        {isHost && isWaiting && (
          <div className="flex flex-col items-center mitimiti-fade-in">
            <QRInvite inviteToken={room.invite_token} size={176} />
            <p className="text-[14px] text-gray-600 text-center -mt-1">
              Pide a tus amigos que lo escaneen con Deuna
            </p>
            <button
              onClick={invite}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#E7F7EE] text-[#0F6B39] text-[14px] font-bold active:scale-95 transition-transform"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
              </svg>
              Invitar por WhatsApp
            </button>
          </div>
        )}

        {/* Cómo quedó la división */}
        {(isLocked || isConfirming) && room.split_mode === 'custom' && (
          <p className="text-[13px] text-[#4C1D80] bg-[#F6F1FD] rounded-xl px-3 py-2 mb-2 text-center">
            {isHost ? 'Pusiste' : `${room.host_name} puso`} montos diferentes para cada uno.
          </p>
        )}
        {centsNote && (
          <p className="text-[12px] text-gray-500 bg-[#F8F8FA] rounded-xl px-3 py-2 mb-2 text-center">
            Por los centavos, alguien paga $0,01 más.
          </p>
        )}

        <div className={isHost && isWaiting ? 'mt-5' : ''}>
          <p className="text-[13px] font-semibold text-gray-500 mb-0.5">En la sala ({participants.length})</p>
          <div className="divide-y divide-gray-50">
            {participants.map((p, i) => (
              <div key={p.id}>
                <ParticipantCard
                  participant={{
                    ...p,
                    amount_cents: isWaiting ? (estimatedAmounts[i] ?? null) : p.amount_cents,
                  }}
                  estimated={isWaiting}
                  showStatus={!isWaiting}
                  isMe={p.user_id === userId}
                  isRoomHost={p.role === 'host'}
                  index={i}
                  hasLoan={roomLoans.some(d => d.debtor_id === p.user_id)}
                />
                {p.confirmation_status === 'requesting_loan' && p.user_id !== userId && (
                  <LoanRequestCard
                    participant={p}
                    spareCents={mySpareCents}
                    onLendMoney={(amount) => lendMoney(p.user_id, p.display_name, amount)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Esperando un préstamo (host incluido) */}
        {myStatus === 'requesting_loan' && myParticipant && (
          <div className="w-full mt-2">
            <LoanWaitingView participant={myParticipant} debts={debts} />
          </div>
        )}
      </div>

      {/* Error inline */}
      {error && (
        <div className="mx-5 mb-2 px-3 py-2 bg-[#FCEBEB] rounded-xl shrink-0">
          <p className="text-[13px] text-[#A32D2D] text-center">{error}</p>
          <button onClick={clearError} className="text-[12px] text-[#A32D2D] underline w-full text-center mt-1">
            Cerrar
          </button>
        </div>
      )}

      {/* Estado + acción principal */}
      <div className="px-5 pt-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shrink-0 space-y-2">
        {renderActions()}
      </div>

      {/* ─── Hojas ─── */}
      {splitSheet && (
        <SplitEditorSheet
          participants={participants}
          totalCents={room.total_cents + room.tip_cents}
          myUserId={userId}
          mode={splitSheet}
          busy={busy}
          onClose={() => setSplitSheet(null)}
          onConfirm={(amounts, isEqual) => runSplit(isEqual ? 'equal' : 'custom', isEqual ? undefined : amounts)}
        />
      )}

      {shortfallFor !== null && (
        <InsufficientFundsModal
          amountCents={shortfallFor}
          balanceCents={balance}
          busy={busy}
          canRequestLoan={participants.length > 1}
          onTopUp={(topUpCents) => topUpAndAccept(topUpCents, shortfallFor)}
          onRequestLoan={() => askForLoan(shortfallFor)}
          onClose={() => setShortfallFor(null)}
        />
      )}

      {confirmSheet && (
        <BottomSheet onClose={() => setConfirmSheet(null)} dismissible={!busy}>
          <div className="flex flex-col items-center px-6 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center">
            <h3 className="text-[19px] font-bold text-[#1a1a1a]">
              {confirmSheet === 'cancel' ? '¿Cancelar la sala?' : '¿Salir de la sala?'}
            </h3>
            <p className="text-[14px] text-gray-500 mt-2 mb-5 px-2">
              {confirmSheet === 'cancel'
                ? 'Se cerrará para todos y no se le cobrará nada a nadie.'
                : `${room.host_name} tendrá que volver a dividir la cuenta entre los demás.`}
            </p>
            <button
              onClick={confirmSheet === 'cancel' ? doCancel : doLeave}
              disabled={busy}
              className="w-full py-4 rounded-[14px] bg-[#A32D2D] text-white text-[16px] font-bold active:scale-[0.98] transition-transform disabled:opacity-70"
            >
              {busy ? 'Un momento…' : confirmSheet === 'cancel' ? 'Sí, cancelar la sala' : 'Sí, salir'}
            </button>
            <button
              onClick={() => setConfirmSheet(null)}
              disabled={busy}
              className="w-full py-3 mt-1.5 rounded-[14px] text-[15px] font-bold text-gray-600 active:bg-gray-50"
            >
              {confirmSheet === 'cancel' ? 'Seguir en la sala' : 'Quedarme'}
            </button>
          </div>
        </BottomSheet>
      )}

      {payDebtOpen && bannerGroup && (
        <PayDebtSheet
          creditorName={bannerGroup.name}
          debts={bannerGroup.debts}
          roomNames={debtRoomNames}
          balanceCents={balance}
          busy={busy}
          onClose={() => setPayDebtOpen(false)}
          onConfirm={payRoomDebt}
        />
      )}
    </div>
  );
}

// ─── Piezas de la barra inferior ─────────────────────────────

function StatusNote({
  icon,
  title,
  subtitle,
  tone = 'neutral',
}: {
  icon: string;
  title: string;
  subtitle?: string;
  tone?: 'neutral' | 'brand' | 'success';
}) {
  const styles = {
    neutral: 'bg-[#F4F4F6] text-[#1a1a1a]',
    brand: 'bg-[#F6F1FD] text-[#2E1250]',
    success: 'bg-[#EAF3DE] text-[#24420A]',
  }[tone];
  return (
    <div className={`w-full rounded-[16px] px-4 py-3 flex items-center gap-3 ${styles}`} role="status">
      <span className="text-[18px] leading-none shrink-0" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="text-[15px] font-bold leading-snug">{title}</p>
        {subtitle && <p className="text-[13px] opacity-80 leading-snug">{subtitle}</p>}
      </div>
    </div>
  );
}

function PrimaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-4 rounded-[14px] text-[16px] font-bold bg-[#4C1D80] text-white active:scale-[0.98] transition-transform disabled:opacity-70"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3.5 rounded-[14px] text-[15px] font-bold bg-white border-2 border-[#EBE3F5] text-[#4C1D80] active:scale-[0.98] transition-transform disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function TextButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-2.5 text-[14px] font-semibold text-gray-500 active:opacity-70 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
