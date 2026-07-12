// ─── RoomView: Sala MitiMiti (Host + Participante) ───────────
import { useState, useCallback, useEffect } from 'react';
import { formatMoney, dividirMonto, getUserProfile } from '../utils';
import QRInvite from './QRInvite';
import ParticipantCard from './ParticipantCard';
import RoomTimer from './RoomTimer';
import ProcessingView from './ProcessingView';
import SuccessView from './SuccessView';
import ErrorView from './ErrorView';
import { useRoom } from '../useRoom';
import CustomSplitModal from './CustomSplitModal';
import InsufficientFundsModal from './InsufficientFundsModal';
import LoanRequestCard from './LoanRequestCard';
import LoanWaitingView from './LoanWaitingView';
import DebtBanner from './DebtBanner';
import { useBalance } from '../useBalance';
import { useDebts } from '../useDebts';
import { trackEvent } from '../analytics';

interface RoomViewProps {
  roomId: string;
  onBack: () => void;
  onExit: () => void;
}

export default function RoomView({ roomId, onBack, onExit }: RoomViewProps) {
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
    requestLoan,
    lendMoney,
    debts,
    clearError,
  } = useRoom(roomId);

  const { balance, deduct } = useBalance();
  const { debtsIOwe, settleDebt } = useDebts();

  const [showQR, setShowQR] = useState(true);
  const [isCustomSplitOpen, setIsCustomSplitOpen] = useState(false);
  const [isInsufficientFundsOpen, setIsInsufficientFundsOpen] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [dismissedDebts, setDismissedDebts] = useState<Set<string>>(new Set());
  const [expiredLocally, setExpiredLocally] = useState(false);

  const profile = getUserProfile();
  const userId = profile?.userId || '';

  // Calcular monto estimado por persona (live)
  const estimatedAmounts = room && participants.length > 0
    ? dividirMonto(room.total_cents + room.tip_cents, participants.length)
    : [];

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

  const handleExpired = useCallback(async () => {
    // Marcar expiración localmente: si el host ya no está en la sala nadie
    // ejecuta el cancel en la BD, y sin esto los participantes quedaban
    // atrapados viendo el timer en 0:00 en una sala "activa" para siempre.
    if (room?.status === 'waiting') {
      setExpiredLocally(true);
    }
    if (isHost && room?.status === 'waiting') {
      await cancelRoom();
    }
  }, [isHost, room?.status, cancelRoom]);

  // Long press para simular fallo (solo host, en confirming)
  const handlePayStart = () => {
    const timer = setTimeout(() => {
      executePayment(true); // simulate failure
    }, 2000);
    setLongPressTimer(timer);
  };

  const handlePayEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
      executePayment(false);
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
      <ErrorView
        message="Sala no encontrada"
        isHost={false}
        onBack={onBack}
      />
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
        onDone={onExit}
      />
    );
  }

  if (room.status === 'failed') {
    return (
      <ErrorView
        message={error || 'El pago falló. Intenta de nuevo.'}
        isHost={isHost}
        onRetry={isHost ? () => executePayment(false) : undefined}
        onCancel={isHost ? cancelRoom : undefined}
        onBack={onExit}
      />
    );
  }

  if (room.status === 'cancelled' || (room.status === 'waiting' && expiredLocally)) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        </div>
        <p className="text-[16px] font-bold text-[#1a1a1a] mb-1">Sala cancelada</p>
        <p className="text-[14px] text-gray-400 mb-6">La sala fue cancelada o expiró</p>
        <button
          onClick={onExit}
          className="px-8 py-3 rounded-[14px] bg-gray-100 text-[#1a1a1a] text-[14px] font-bold"
        >
          Volver
        </button>
      </div>
    );
  }

  // ─── Vista principal de la sala ─────────────────────────

  const isWaiting = room.status === 'waiting';
  const isLocked = room.status === 'locked';
  const isConfirming = room.status === 'confirming';
  const confirmedCount = participants.filter(p => p.confirmation_status === 'confirmed').length;
  const canLock = isWaiting && participants.length >= 2;
  const hasConfirmed = myParticipant?.confirmation_status === 'confirmed';

  const roomDebts = debtsIOwe.filter(d => participants.some(p => p.user_id === d.creditor_id));
  const activeRoomDebt = roomDebts.find(d => !dismissedDebts.has(d.id));

  // Cuánto puedo prestar de verdad: mi saldo, menos mi propia parte, menos
  // lo que YA presté en esta sala. Nunca debo comprometer mi parte.
  const myShareCents = myParticipant?.amount_cents || 0;
  const myLentInRoom = debts
    .filter(d => d.creditor_id === userId)
    .reduce((acc, d) => acc + d.amount_cents, 0);
  const mySpareCents = Math.max(0, balance - myShareCents - myLentInRoom);

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-2 shrink-0">
        <button onClick={onBack}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-[17px] font-bold text-[#1a1a1a]">MitiMiti</h1>
        {isHost && (isWaiting || isLocked) && (
          <button
            onClick={cancelRoom}
            className="text-[13px] font-semibold text-red-500"
          >
            Cancelar
          </button>
        )}
        {!isHost && <div className="w-16" />}
      </div>

      {/* Info de la sala */}
      <div className="mx-5 bg-[#F8F8FA] rounded-2xl px-4 py-3 flex items-center justify-between border border-gray-100 shrink-0">
        <div>
          <p className="text-[11px] text-gray-400">Nombre de la sala</p>
          <p className="text-[15px] font-bold text-[#1a1a1a]">{room.commerce_name}</p>
        </div>
        <div className="text-right">
          <p className="text-[28px] font-bold text-[#1a1a1a] leading-none">
            {formatMoney(room.total_cents)}
          </p>
          <RoomTimer expiresAt={room.expires_at} onExpired={handleExpired} />
        </div>
      </div>

      {activeRoomDebt && isWaiting && (
        <div className="mt-4 shrink-0">
          <DebtBanner 
            debt={activeRoomDebt}
            onDismiss={() => setDismissedDebts(prev => new Set(prev).add(activeRoomDebt.id))}
            onPay={async () => {
              if (balance < activeRoomDebt.amount_cents) {
                alert('No tienes saldo suficiente');
                return;
              }
              await settleDebt(activeRoomDebt.id);
              deduct(activeRoomDebt.amount_cents);
              alert('Deuda pagada');
            }}
          />
        </div>
      )}

      {/* Toggle QR / Participantes (solo host en waiting) */}
      {isHost && isWaiting && (
        <div className="mx-5 mt-3 shrink-0">
          <div className="mitimiti-toggle-container">
            <button
              className={`mitimiti-toggle-btn ${showQR ? 'active' : ''}`}
              onClick={() => setShowQR(true)}
            >
              Código QR
            </button>
            <button
              className={`mitimiti-toggle-btn ${!showQR ? 'active' : ''}`}
              onClick={() => setShowQR(false)}
            >
              Participantes ({participants.length})
            </button>
          </div>
        </div>
      )}

      {/* Contenido central */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {/* QR de invitación (Host, en waiting, si showQR) */}
        {isHost && isWaiting && showQR && (
          <div className="flex flex-col items-center mitimiti-fade-in">
            <div className="my-3">
              <QRInvite inviteToken={room.invite_token} size={200} />
            </div>
            <p className="text-[13px] text-gray-400 text-center mt-2 mb-1">
              Escanea para unirte a la sala
            </p>

            {/* Compartir link centrado */}
            <button
              onClick={async () => {
                const shareUrl = `${window.location.origin}/#/mitimiti/join/${room.invite_token}`;
                if (navigator.share) {
                  await navigator.share({
                    title: 'MitiMiti',
                    text: `Únete a la sala de pago: ${room.commerce_name}`,
                    url: shareUrl,
                  }).catch(console.error);
                } else {
                  await navigator.clipboard.writeText(shareUrl);
                  alert('Link de invitación copiado');
                }
              }}
              className="flex items-center justify-center gap-2 active:opacity-70 transition-opacity mb-4"
            >
              <div className="w-[34px] h-[34px] rounded-full bg-[#F8F8FA] flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
              </div>
              <span className="text-[13px] text-gray-500 font-medium">Genera un link y compártelo</span>
            </button>

            {/* Mini lista de participantes debajo del QR */}
            <div className="w-full mt-4">
              <p className="text-[13px] font-semibold text-gray-400 mb-1">
                Participantes ({participants.length})
              </p>
              {participants.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 py-1.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `hsl(${Math.abs(p.display_name.charCodeAt(0) * 37) % 360}, 65%, 55%)` }}
                  >
                    <span className="text-white text-[9px] font-bold">
                      {p.display_name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[13px] text-[#1a1a1a] truncate">{p.display_name}</span>
                  <span className="text-[13px] text-gray-400 ml-auto">
                    ~{formatMoney(estimatedAmounts[i] || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de participantes (vista principal) */}
        {((!isHost || !isWaiting || !showQR) && (isWaiting || isLocked || isConfirming)) && (
          <div className="mitimiti-fade-in">
            {/* Nota de centavos sobrantes */}
            {room.total_cents % participants.length !== 0 && (isLocked || isConfirming) && (
              <p className="text-[12px] text-gray-400 bg-[#F8F8FA] rounded-xl px-3 py-2 mb-3 text-center">
                El total se distribuyó equitativamente. La diferencia máxima es de $0,01.
              </p>
            )}

            <div className="divide-y divide-gray-50">
              {participants.map((p, i) => (
                <div key={p.id}>
                  <ParticipantCard
                    participant={{
                      ...p,
                      amount_cents: isWaiting ? (estimatedAmounts[i] || null) : p.amount_cents,
                    }}
                    isMe={p.user_id === userId}
                    isRoomHost={p.role === 'host'}
                    index={i}
                    hasLoan={debts.some(d => d.debtor_id === p.user_id)}
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

              {/* Añadir de contactos (Sólo visible para host durante waiting) */}
              {isHost && isWaiting && (
                <button 
                  onClick={() => alert('Simulación: Abriendo contactos para invitar...')}
                  className="w-full flex items-center gap-4 py-4 px-2 active:bg-gray-50 transition-colors"
                >
                  <div className="w-[42px] h-[42px] rounded-full bg-[#F8F8FA] flex items-center justify-center shrink-0 border border-gray-200 border-dashed">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4C1D80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                  <span className="text-[15px] font-bold text-[#4C1D80]">Añadir desde contactos</span>
                </button>
              )}
            </div>

            {/* Esperando participantes */}
            {isWaiting && participants.length < 2 && (
              <p className="text-[13px] text-gray-400 text-center mt-4">
                Esperando que alguien se una...
              </p>
            )}

            {/* View para el deudor (host incluido) */}
            {myParticipant?.confirmation_status === 'requesting_loan' && (
              <div className="w-full mt-2">
                <LoanWaitingView 
                  participant={myParticipant} 
                  debts={debts}
                />
              </div>
            )}

            {/* Conteo de confirmaciones */}
            {isLocked && (
              <div className="text-center mt-4">
                <p className="text-[14px] font-semibold text-[#4C1D80]">
                  {confirmedCount} de {participants.length} confirmaron
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error inline */}
      {error && (
        <div className="mx-5 mb-2 px-3 py-2 bg-[#FCEBEB] rounded-xl shrink-0">
          <p className="text-[12px] text-[#A32D2D] text-center">{error}</p>
          <button onClick={clearError} className="text-[11px] text-[#A32D2D] underline w-full text-center mt-1">
            Cerrar
          </button>
        </div>
      )}

      {/* CTA (botón de acción principal) */}
      <div className="px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shrink-0">
        {/* HOST: Waiting → "Listo" */}
        {isHost && isWaiting && (
          <button
            onClick={() => setIsCustomSplitOpen(true)}
            disabled={!canLock}
            className={`w-full py-4 rounded-[14px] text-[16px] font-bold transition-all ${
              canLock
                ? 'bg-[#4C1D80] text-white active:scale-[0.98]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {participants.length < 2 ? 'Necesitas 2+ personas' : 'Listo'}
          </button>
        )}

        {/* HOST: Locked + ya confirmó → "Esperando..." */}
        {isHost && isLocked && hasConfirmed && (
          <button
            disabled
            className="w-full py-4 rounded-[14px] text-[16px] font-bold bg-gray-200 text-gray-400 cursor-not-allowed"
          >
            Esperando... ({confirmedCount}/{participants.length})
          </button>
        )}

        {/* HOST: Confirming → "Pagar" */}
        {isHost && isConfirming && (
          <button
            onMouseDown={handlePayStart}
            onMouseUp={handlePayEnd}
            onMouseLeave={() => {
              if (longPressTimer) {
                clearTimeout(longPressTimer);
                setLongPressTimer(null);
              }
            }}
            onTouchStart={handlePayStart}
            onTouchEnd={handlePayEnd}
            className="w-full py-4 rounded-[14px] text-[16px] font-bold bg-[#4C1D80] text-white active:scale-[0.98] transition-transform"
          >
            Pagar {formatMoney(room.total_cents)}
          </button>
        )}

        {/* TODOS (host incluido): Locked + pendiente → "Acepto" con chequeo
            de saldo. El host también puede quedarse corto y pedir préstamo. */}
        {isLocked && !hasConfirmed && myParticipant?.confirmation_status !== 'requesting_loan' && myParticipant && (
          <button
            onClick={() => {
              const myAmount = myParticipant.amount_cents || 0;
              if (myAmount > balance) {
                setIsInsufficientFundsOpen(true);
              } else {
                confirmPayment();
              }
            }}
            className="w-full py-4 rounded-[14px] text-[16px] font-bold bg-[#4C1D80] text-white active:scale-[0.98] transition-transform"
          >
            Acepto {formatMoney(myParticipant.amount_cents || 0)}
          </button>
        )}

        {/* PARTICIPANTE: Ya confirmó → "Esperando..." */}
        {!isHost && (isLocked || isConfirming) && hasConfirmed && (
          <button
            disabled
            className="w-full py-4 rounded-[14px] text-[16px] font-bold bg-gray-200 text-gray-400 cursor-not-allowed flex justify-center items-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Esperando al host...
          </button>
        )}

        {/* PARTICIPANTE: Waiting o Requesting Loan → "Salir" */}
        {!isHost && (isWaiting || myParticipant?.confirmation_status === 'requesting_loan') && (
          <button
            onClick={async () => { await leaveRoom(); onExit(); }}
            className="w-full py-4 rounded-[14px] text-[16px] font-bold bg-gray-100 text-gray-500 active:scale-[0.98] transition-transform"
          >
            Salir de la sala
          </button>
        )}
      </div>
      
      <CustomSplitModal
        isOpen={isCustomSplitOpen}
        onClose={() => setIsCustomSplitOpen(false)}
        participants={participants}
        totalCents={room.total_cents + room.tip_cents}
        onConfirm={(mode, amounts) => {
          setIsCustomSplitOpen(false);
          lockRoom(mode, amounts);
        }}
      />

      <InsufficientFundsModal
        isOpen={isInsufficientFundsOpen}
        onClose={() => setIsInsufficientFundsOpen(false)}
        amountCents={myParticipant?.amount_cents || 0}
        balanceCents={balance}
        onRequestLoan={() => {
          setIsInsufficientFundsOpen(false);
          requestLoan((myParticipant?.amount_cents || 0) - balance);
        }}
      />
    </div>
  );
}
