// ─── NewDebtView: "Anotar deuda" ─────────────────────────────
// Para las deudas que nacen fuera de una sala: "le presté $1,50 a Juan para
// el taxi" o "Juan me prestó $1,50", en efectivo o por transferencia.
//
// Igual que crear una sala, es UNA pantalla y lo normal es: escribir el
// monto y tocar el botón. Quién prestó ya viene elegido ("Yo presté", o lo
// que corresponda a la pestaña de Mis deudas desde donde llegaste) y "para
// qué fue" es opcional. El mismo toque anota la deuda y abre WhatsApp con el
// link. No se escribe el nombre del amigo: él queda anotado con su propio
// perfil al abrir el link, y en WhatsApp ya lo eliges de tus chats.
import { useState, useRef } from 'react';
import type { Debt, LoanDirection } from '../types';
import { createDirectDebt } from '../supabase';
import {
  getUserProfile,
  toCents,
  formatMoney,
  relativeDate,
  conceptEmoji,
  DEBT_CONCEPTS,
  DEFAULT_DEBT_CONCEPT,
} from '../utils';
import { openWhatsApp, debtLinkMessage } from '../share';
import { creatorLent } from '../debtGroups';
import { trackEvent } from '../analytics';
import { useDebts } from '../useDebts';
import DebtLinkActions, { ChatIcon } from './DebtLinkActions';

interface NewDebtViewProps {
  initialDirection?: LoanDirection;
  onBack: () => void;
  onOpenDebts: (tab: 'owe' | 'owed') => void;
}

const DIRECTIONS: { value: LoanDirection; label: string }[] = [
  { value: 'lent', label: 'Yo presté' },
  { value: 'borrowed', label: 'Me prestaron' },
];

export default function NewDebtView({ initialDirection = 'lent', onBack, onOpenDebts }: NewDebtViewProps) {
  const [direction, setDirection] = useState<LoanDirection>(initialDirection);
  const [amount, setAmount] = useState('0');
  const [concept, setConcept] = useState<string | null>(null);
  const [showConceptModal, setShowConceptModal] = useState(false);
  const [draftConcept, setDraftConcept] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ debt: Debt; shared: boolean } | null>(null);
  const [profile] = useState(() => getUserProfile());
  const chipsRef = useRef<HTMLDivElement>(null);
  // Para enterarse en vivo ("Juan aceptó") mientras sigues en esta pantalla.
  useDebts();

  const lent = direction === 'lent';
  const hasAmount = toCents(amount) > 0;
  const isSuggested = DEBT_CONCEPTS.some(c => c.label === concept);

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
    // Limitar decimales a 2 y la parte entera a 4 dígitos ($9.999): es un
    // préstamo entre amigos, no una cuenta de restaurante.
    const [intPart, decPart] = amount.split(',');
    if (decPart !== undefined && decPart.length >= 2) return;
    if (decPart === undefined && intPart.length >= 4 && amount !== '0') return;
    setAmount(prev => (prev === '0' ? key : prev + key));
  };

  const handleCreate = async () => {
    if (!profile || !hasAmount || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const debt = await createDirectDebt(profile.userId, profile.displayName, direction, toCents(amount), concept);
      // Mismo toque: WhatsApp con el mensaje y el link. Si el navegador lo
      // bloquea, la pantalla siguiente lo pide con un botón.
      const shared = openWhatsApp(debtLinkMessage(debt));
      if (shared) {
        trackEvent('DEBT_LINK_SHARED', undefined, profile.userId, { debtId: debt.id, channel: 'whatsapp', auto: true });
      }
      setCreated({ debt, shared });
    } catch (err) {
      // Si la BD no tiene la migración de deudas anotadas a mano
      // (supabase-setup.sql, sección 7), el motivo real queda en la consola.
      console.error('Error anotando la deuda:', err);
      setCreateError('No pudimos anotar la deuda. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setCreating(false);
    }
  };

  const toggleConcept = (label: string) => setConcept(prev => (prev === label ? null : label));

  const saveCustomConcept = () => {
    const clean = draftConcept.trim();
    if (!clean) return;
    setConcept(clean);
    setShowConceptModal(false);
    // El concepto propio aparece como primer chip: volver al inicio de la fila.
    chipsRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  };

  if (created) {
    return (
      <DebtCreated
        debt={created.debt}
        shared={created.shared}
        onBack={onBack}
        onDone={() => onOpenDebts(creatorLent(created.debt) ? 'owed' : 'owe')}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-2 shrink-0">
        <button onClick={onBack} aria-label="Volver" className="w-24 text-left p-1 -ml-1">
          <BackIcon />
        </button>
        <h1 className="text-[17px] font-bold text-[#1a1a1a]">Anotar deuda</h1>
        <div className="w-24 flex justify-end">
          <button
            onClick={() => onOpenDebts(lent ? 'owed' : 'owe')}
            className="text-[13px] font-semibold text-[#4C1D80] py-1"
          >
            Mis deudas
          </button>
        </div>
      </div>

      {/* ¿Quién prestó? Ya viene elegido: casi siempre es "Yo presté". */}
      <div
        role="radiogroup"
        aria-label="¿Quién prestó?"
        className="mx-5 mt-1 p-1 bg-[#F4F4F6] rounded-full grid grid-cols-2 shrink-0"
      >
        {DIRECTIONS.map(({ value, label }) => (
          <button
            key={value}
            role="radio"
            aria-checked={direction === value}
            onClick={() => setDirection(value)}
            className={`py-2.5 rounded-full text-[15px] font-bold transition-all ${
              direction === value ? 'bg-[#4C1D80] text-white shadow-[0_1px_3px_rgba(76,29,128,0.25)]' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Monto */}
      <div className="text-center mt-4 mb-2 shrink-0 px-6">
        <p className="text-[#4C1D80] text-[14px] font-semibold mb-1">
          {lent ? '¿Cuánto le prestaste?' : '¿Cuánto te prestaron?'}
        </p>
        <p className="text-[46px] font-bold text-[#1a1a1a] leading-none tracking-tight tabular-nums">
          $ {amount}
        </p>
        <p className="text-[12px] text-gray-500 mt-2 leading-snug">
          {lent
            ? 'Le llega un link por WhatsApp y te paga en un toque cuando pueda.'
            : 'Le llega un link por WhatsApp para que confirme lo que le debes.'}
        </p>
      </div>

      {/* ¿Para qué fue? — opcional, un toque */}
      <div className="shrink-0 mt-1">
        <p className="text-[12px] font-semibold text-gray-500 px-5 mb-1.5">
          ¿Para qué fue? <span className="font-normal">(opcional)</span>
        </p>
        <div ref={chipsRef} className="mitimiti-chips-row px-5 pb-1">
          {concept && !isSuggested && (
            <button
              type="button"
              className="mitimiti-chip active"
              aria-pressed="true"
              onClick={() => { setDraftConcept(concept); setShowConceptModal(true); }}
            >
              <span className="text-[16px] leading-none">✏️</span>
              {concept}
            </button>
          )}
          {DEBT_CONCEPTS.map(({ emoji, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleConcept(label)}
              className={`mitimiti-chip ${concept === label ? 'active' : ''}`}
              aria-pressed={concept === label}
            >
              <span className="text-[16px] leading-none">{emoji}</span>
              {label}
            </button>
          ))}
          <button
            type="button"
            className="mitimiti-chip"
            onClick={() => { setDraftConcept(isSuggested || !concept ? '' : concept); setShowConceptModal(true); }}
          >
            <span className="text-[16px] leading-none">✏️</span>
            Otro
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

      {/* CTA: anota y comparte en el mismo toque */}
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
          {creating ? (
            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <ChatIcon size={18} />
          )}
          {creating ? 'Anotando…' : 'Anotar y enviar por WhatsApp'}
        </button>
      </div>

      {/* Concepto propio (solo si ninguna sugerencia sirve) */}
      {showConceptModal && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-start justify-center pt-4 px-4 animate-fadeIn" onClick={() => setShowConceptModal(false)}>
          <div className="bg-white w-full rounded-3xl p-6 shadow-2xl animate-slideDown" onClick={e => e.stopPropagation()}>
            <h3 className="text-[20px] font-bold text-[#1a1a1a] mb-1 text-center">¿Para qué fue?</h3>
            <p className="text-[14px] text-gray-500 mb-4 text-center">Así los dos lo reconocen después.</p>
            <input
              type="text"
              value={draftConcept}
              onChange={(e) => setDraftConcept(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveCustomConcept(); }}
              placeholder="Ej. Regalo de Ana"
              maxLength={40}
              enterKeyHint="done"
              className="w-full bg-[#F8F8FA] border border-gray-100 rounded-2xl py-3 px-4 text-[16px] text-[#1a1a1a] focus:outline-none focus:border-[#4C1D80] focus:ring-1 focus:ring-[#4C1D80] transition-colors mb-4"
              autoFocus
            />
            <button
              onClick={saveCustomConcept}
              disabled={!draftConcept.trim()}
              className={`w-full py-4 rounded-[16px] text-[16px] font-bold transition-all ${
                draftConcept.trim()
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

// ─── Anotada: confirmar y (si hace falta) mandar el link ─────
function DebtCreated({
  debt,
  shared,
  onBack,
  onDone,
}: {
  debt: Debt;
  shared: boolean;
  onBack: () => void;
  onDone: () => void;
}) {
  const lent = creatorLent(debt);
  const concept = debt.concept || DEFAULT_DEBT_CONCEPT;
  // Si WhatsApp no se pudo abrir solo, el botón grande es mandarlo; una vez
  // mandado, el botón grande pasa a ser "Listo".
  const [sent, setSent] = useState(shared);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center px-5 pt-14 pb-2 shrink-0">
        <button onClick={onBack} aria-label="Ir al inicio" className="p-1 -ml-1">
          <BackIcon />
        </button>
      </div>

      <div className="flex flex-col items-center flex-1 overflow-y-auto px-6 pt-4 text-center">
        <div className="mitimiti-check mb-4">
          <div className="w-20 h-20 bg-[#2FD9A9] rounded-full flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
        <h2 className="text-[22px] font-bold text-[#1a1a1a]">¡Quedó anotado!</h2>

        <div className="w-full bg-[#F8F8FA] rounded-2xl p-4 mt-4 border border-gray-100">
          <p className="text-[13px] text-gray-500">{lent ? 'Te deben' : 'Debes'}</p>
          <p className={`text-[36px] font-black leading-tight tabular-nums ${lent ? 'text-[#3B6D11]' : 'text-[#1a1a1a]'}`}>
            {formatMoney(debt.amount_cents)}
          </p>
          <p className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full bg-white border border-gray-100 text-[13px] font-semibold text-[#1a1a1a]">
            <span aria-hidden="true">{conceptEmoji(debt.concept)}</span>
            {concept} · {relativeDate(debt.created_at)}
          </p>
        </div>

        {sent ? (
          <p className="text-[14px] text-gray-600 mt-4 leading-snug px-2">
            {lent
              ? 'Cuando tu amigo abra el link, podrá pagarte en un toque. Te avisaremos cuando lo haga.'
              : 'Cuando tu amigo abra el link y lo confirme, podrás pagarle en un toque desde Mis deudas.'}
          </p>
        ) : (
          <p className="text-[14px] text-[#4C1D80] font-semibold mt-4 leading-snug px-2">
            Falta un paso: envíale el link a tu amigo.
          </p>
        )}
      </div>

      <div className="px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shrink-0">
        <DebtLinkActions debt={debt} sent={sent} onSent={() => setSent(true)} />
        <button
          onClick={onDone}
          className={sent
            ? 'w-full py-4 mt-2.5 rounded-[14px] bg-[#4C1D80] text-white text-[16px] font-bold active:scale-[0.98] transition-transform'
            : 'w-full py-3 mt-1.5 rounded-[14px] text-[15px] font-bold text-gray-600 active:bg-gray-50'}
        >
          Listo
        </button>
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
