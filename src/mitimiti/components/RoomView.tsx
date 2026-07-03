// ─── RoomView: Sala MitiMiti (Host + Participante) ───────────
import { useState, useCallback } from 'react';
import { formatMoney, dividirMonto, getUserProfile } from '../utils';
import QRInvite from './QRInvite';
import ParticipantCard from './ParticipantCard';
import RoomTimer from './RoomTimer';
import ProcessingView from './ProcessingView';
import SuccessView from './SuccessView';
import ErrorView from './ErrorView';
import { useRoom } from '../useRoom';

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
    clearError,
  } = useRoom(roomId);

  const [showQR, setShowQR] = useState(true);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const profile = getUserProfile();
  const userId = profile?.userId || '';

  // Calcular monto estimado por persona (live)
  const estimatedAmounts = room && participants.length > 0
    ? dividirMonto(room.total_cents + room.tip_cents, participants.length)
    : [];

  const handleExpired = useCallback(async () => {
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

  if (room.status === 'cancelled') {
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
            <p className="text-[13px] text-gray-400 text-center mt-2 mb-3">
              Escanea para unirte a la sala
            </p>

            {/* Compartir link al estilo DeUna (lista) */}
            <div className="mt-4 w-full">
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
                className="w-full flex items-center justify-between py-3 px-1 active:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-[42px] h-[42px] rounded-full bg-[#F8F8FA] flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-[14px] font-bold text-[#1a1a1a] mb-0.5">Envía un link de cobro</p>
                    <p className="text-[12px] text-gray-500 font-medium leading-tight">Genera un link y compártelo</p>
                  </div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

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
                <ParticipantCard
                  key={p.id}
                  participant={{
                    ...p,
                    // En waiting, mostrar monto estimado
                    amount_cents: isWaiting ? (estimatedAmounts[i] || null) : p.amount_cents,
                  }}
                  isMe={p.user_id === userId}
                  isRoomHost={p.role === 'host'}
                  index={i}
                />
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
      <div className="px-5 pb-4 shrink-0">
        {/* HOST: Waiting → "Listo" */}
        {isHost && isWaiting && (
          <button
            onClick={lockRoom}
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

        {/* HOST: Locked → "Esperando..." */}
        {isHost && isLocked && (
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

        {/* PARTICIPANTE: Locked + pendiente → "Acepto" */}
        {!isHost && isLocked && !hasConfirmed && myParticipant && (
          <button
            onClick={confirmPayment}
            className="w-full py-4 rounded-[14px] text-[16px] font-bold bg-[#4C1D80] text-white active:scale-[0.98] transition-transform"
          >
            Acepto {formatMoney(myParticipant.amount_cents || 0)}
          </button>
        )}

        {/* PARTICIPANTE: Ya confirmó → "Esperando..." */}
        {!isHost && (isLocked || isConfirming) && hasConfirmed && (
          <button
            disabled
            className="w-full py-4 rounded-[14px] text-[16px] font-bold bg-[#EAF3DE] text-[#3B6D11]"
          >
            ✅ Esperando al host...
          </button>
        )}

        {/* PARTICIPANTE: Waiting → "Salir" */}
        {!isHost && isWaiting && (
          <button
            onClick={async () => { await leaveRoom(); onExit(); }}
            className="w-full py-4 rounded-[14px] text-[16px] font-bold bg-gray-100 text-gray-500 active:scale-[0.98] transition-transform"
          >
            Salir de la sala
          </button>
        )}
      </div>
    </div>
  );
}
