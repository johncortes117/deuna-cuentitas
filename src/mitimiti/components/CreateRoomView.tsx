// ─── CreateRoomView: "¿Cuánto es la cuenta?" ─────────────────
// Antes: monto → Continuar → modal "Nombra tu sala" (con el teclado del
// sistema abierto encima de las sugerencias) → Crear sala.
// Ahora: monto + nombre en la misma pantalla, con un nombre ya sugerido
// según la hora. Lo normal es: escribir el monto y tocar "Crear sala".
import { useState, useEffect, useRef } from 'react';
import { useDebts } from '../useDebts';
import { getActiveRoomForUser } from '../supabase';
import { getUserProfile, ROOM_NAME_SUGGESTIONS, suggestRoomName, activeRoomHint, toCents } from '../utils';
import type { ActiveRoom } from '../types';

interface CreateRoomViewProps {
  initialCommerceName?: string;
  initialAmount?: string; // "48,00"
  onCreateRoom: (commerceName: string, amountStr: string) => Promise<void>;
  onRejoinRoom: (roomId: string) => void;
  onBack: () => void;
}

export default function CreateRoomView({
  initialCommerceName = '',
  initialAmount = '0',
  onCreateRoom,
  onRejoinRoom,
  onBack,
}: CreateRoomViewProps) {
  const [name, setName] = useState(() => initialCommerceName.trim() || suggestRoomName());
  const [amount, setAmount] = useState(initialAmount);
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const { debtsIOwe } = useDebts();
  const userId = getUserProfile()?.userId ?? '';

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    getActiveRoomForUser(userId)
      .then(room => { if (alive) setActiveRoom(room); })
      .catch(() => {});
    return () => { alive = false; };
  }, [userId]);

  const handleKey = (key: string) => {
    setCreateError(null);
    if (key === 'del') {
      setAmount(prev => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
      return;
    }
    if (key === ',') {
      if (amount.includes(',')) return;
      setAmount(prev => prev + ',');
      return;
    }
    // Limitar decimales a 2 y la parte entera a 5 dígitos ($99.999)
    const [intPart, decPart] = amount.split(',');
    if (decPart !== undefined && decPart.length >= 2) return;
    if (decPart === undefined && intPart.length >= 5 && amount !== '0') return;
    setAmount(prev => (prev === '0' ? key : prev + key));
  };

  const hasAmount = toCents(amount) > 0;
  const isSuggested = ROOM_NAME_SUGGESTIONS.some(s => s.label === name);

  const handleCreate = async () => {
    if (!hasAmount || !name.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      await onCreateRoom(name.trim(), amount);
    } catch {
      setCreateError('No pudimos crear la sala. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setCreating(false);
    }
  };

  const saveCustomName = () => {
    const clean = draftName.trim();
    if (!clean) return;
    setName(clean);
    setShowNameModal(false);
    // El nombre propio aparece como primer chip: volver al inicio de la fila
    // para que se vea seleccionado (el "Otro nombre" que se tocó está al final).
    chipsRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-2 shrink-0">
        <button onClick={onBack} aria-label="Volver" className="w-24 text-left p-1 -ml-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-[17px] font-bold text-[#1a1a1a]">MitiMiti</h1>
        <div className="w-24 flex justify-end">
          <button
            onClick={() => { window.location.hash = '#/mitimiti/debts'; }}
            className="relative text-[13px] font-semibold text-[#4C1D80] py-1"
          >
            Mis deudas
            {debtsIOwe.length > 0 && (
              <span className="absolute -top-0.5 -right-2.5 w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-white" aria-label="Tienes deudas por pagar" />
            )}
          </button>
        </div>
      </div>

      {/* Sala abierta: volver en un toque */}
      {activeRoom && (
        <button
          onClick={() => onRejoinRoom(activeRoom.room.id)}
          className="mx-5 mb-2 p-3.5 rounded-2xl bg-[#F8F5FB] border border-[#EBE3F5] flex items-center gap-3 shadow-sm animate-fadeIn text-left shrink-0 active:scale-[0.98] transition-transform"
        >
          <span className="w-9 h-9 rounded-full bg-[#4C1D80]/10 flex items-center justify-center shrink-0">
            <span className="animate-pulse w-2.5 h-2.5 bg-[#4C1D80] rounded-full" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[11px] font-bold text-[#4C1D80] uppercase tracking-wide">Tienes una sala abierta</span>
            <span className="block text-[15px] font-bold text-[#1a1a1a] truncate">{activeRoom.room.commerce_name}</span>
            <span className="block text-[12px] text-gray-600 truncate">{activeRoomHint(activeRoom, userId)}</span>
          </span>
          <span className="text-[13px] font-bold text-[#4C1D80] shrink-0">Volver</span>
        </button>
      )}

      {/* Monto */}
      <div className="text-center mt-2 mb-2 shrink-0 px-6">
        <p className="text-[#4C1D80] text-[14px] font-semibold mb-1">¿Cuánto es la cuenta?</p>
        <p className="text-[46px] font-bold text-[#1a1a1a] leading-none tracking-tight tabular-nums">
          $ {amount}
        </p>
        <p className="text-[12px] text-gray-500 mt-2 leading-snug">
          Después tus amigos escanean tu código y cada uno acepta su parte.
        </p>
      </div>

      {/* ¿Para qué es? — nombre sugerido, cambiable con un toque */}
      <div className="shrink-0 mt-1">
        <p className="text-[12px] font-semibold text-gray-500 px-5 mb-1.5">¿Para qué es?</p>
        <div ref={chipsRef} className="mitimiti-chips-row px-5 pb-1">
          {!isSuggested && name && (
            <button type="button" className="mitimiti-chip active" onClick={() => { setDraftName(name); setShowNameModal(true); }}>
              <span className="text-[16px] leading-none">✏️</span>
              {name}
            </button>
          )}
          {ROOM_NAME_SUGGESTIONS.map(({ emoji, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => setName(label)}
              className={`mitimiti-chip ${name === label ? 'active' : ''}`}
              aria-pressed={name === label}
            >
              <span className="text-[16px] leading-none">{emoji}</span>
              {label}
            </button>
          ))}
          <button
            type="button"
            className="mitimiti-chip"
            onClick={() => { setDraftName(isSuggested ? '' : name); setShowNameModal(true); }}
          >
            <span className="text-[16px] leading-none">✏️</span>
            Otro nombre
          </button>
        </div>
      </div>

      {/* Teclado numérico */}
      <div className="grid grid-cols-3 gap-y-0.5 px-5 flex-1 content-center min-h-0">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'].map(key => (
          <button
            key={key}
            onClick={() => handleKey(key)}
            aria-label={key === 'del' ? 'Borrar' : key}
            className="flex items-center justify-center py-2.5 rounded-xl text-[28px] font-semibold text-[#4C1D80] active:bg-gray-100 transition-colors"
          >
            {key === 'del' ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4C1D80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                <line x1="18" y1="9" x2="12" y2="15" />
                <line x1="12" y1="9" x2="18" y2="15" />
              </svg>
            ) : key}
          </button>
        ))}
      </div>

      {/* CTA */}
      <div className="px-5 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shrink-0">
        {createError && (
          <p className="text-[13px] text-[#A32D2D] bg-[#FCEBEB] rounded-xl px-3 py-2 text-center mb-2">{createError}</p>
        )}
        <button
          onClick={handleCreate}
          disabled={!hasAmount || creating}
          className={`w-full py-4 rounded-[14px] text-[16px] font-bold transition-all flex items-center justify-center gap-2 ${
            hasAmount
              ? 'bg-[#4C1D80] text-white active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          } ${creating ? 'opacity-80 cursor-wait' : ''}`}
        >
          {creating && (
            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          )}
          {creating ? 'Creando sala…' : 'Crear sala'}
        </button>
      </div>

      {/* Nombre propio (solo si ninguna sugerencia sirve) */}
      {showNameModal && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-start justify-center pt-4 px-4 animate-fadeIn" onClick={() => setShowNameModal(false)}>
          <div className="bg-white w-full rounded-3xl p-6 shadow-2xl animate-slideDown" onClick={e => e.stopPropagation()}>
            <h3 className="text-[20px] font-bold text-[#1a1a1a] mb-1 text-center">¿Para qué es la cuenta?</h3>
            <p className="text-[14px] text-gray-500 mb-4 text-center">Así todos la reconocen en su historial.</p>
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveCustomName(); }}
              placeholder="Ej. Almuerzo del equipo"
              maxLength={40}
              enterKeyHint="done"
              className="w-full bg-[#F8F8FA] border border-gray-100 rounded-2xl py-3 px-4 text-[16px] text-[#1a1a1a] focus:outline-none focus:border-[#4C1D80] focus:ring-1 focus:ring-[#4C1D80] transition-colors mb-4"
              autoFocus
            />
            <button
              onClick={saveCustomName}
              disabled={!draftName.trim()}
              className={`w-full py-4 rounded-[16px] text-[16px] font-bold transition-all ${
                draftName.trim()
                  ? 'bg-[#4C1D80] text-white active:scale-[0.98]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Usar este nombre
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
