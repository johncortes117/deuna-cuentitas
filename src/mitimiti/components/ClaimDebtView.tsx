// ─── ClaimDebtView: el amigo abre el link de una deuda ───────
// Lo que ve quien recibe el link por WhatsApp. Una sola pregunta y la
// respuesta más común en el botón grande:
//
//  • Si te prestaron: "Pedro te prestó $1,50" → Pagar ahora (2 toques, con
//    la misma hoja de pago y recarga de Mis deudas) o "Pagar después", que
//    la deja anotada (1 toque).
//  • Si alguien anotó que te debe: "Pedro anotó que te debe $1,50" → "Sí,
//    me debe" (1 toque).
//
// Siempre hay una salida discreta, "No le debo nada", para que nadie quede
// con una deuda que no reconoce; quien la anotó se entera.
import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Debt } from '../types';
import { getDebtByToken, respondToDebtLink, settleDebts } from '../supabase';
import { getUserProfile, formatMoney, relativeDate, conceptEmoji, DEFAULT_DEBT_CONCEPT } from '../utils';
import { creatorLent } from '../debtGroups';
import { useBalance } from '../useBalance';
import { trackEvent } from '../analytics';
import Avatar from './Avatar';
import BottomSheet from './BottomSheet';
import PayDebtSheet from './PayDebtSheet';
import DebtLinkActions from './DebtLinkActions';

interface ClaimDebtViewProps {
  token: string;
  onBack: () => void;
  onOpenDebts: (tab: 'owe' | 'owed') => void;
}

type Outcome = 'paid' | 'later' | 'accepted' | 'declined';

export default function ClaimDebtView({ token, onBack, onOpenDebts }: ClaimDebtViewProps) {
  // undefined: cargando · null: el link no existe
  const [debt, setDebt] = useState<Debt | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [sheet, setSheet] = useState<'pay' | 'decline' | null>(null);
  const [profile] = useState(() => getUserProfile());
  const { balance, deduct, add } = useBalance();
  const userId = profile?.userId ?? '';
  const trackedOpen = useRef(false);

  useEffect(() => {
    let alive = true;
    getDebtByToken(token)
      .then(found => {
        if (!alive) return;
        setLoadError(false);
        setDebt(found);
        if (found && !trackedOpen.current) {
          trackedOpen.current = true;
          trackEvent('DEBT_LINK_OPENED', undefined, userId, { debtId: found.id, status: found.status });
        }
      })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, [token, attempt, userId]);

  const reload = () => setAttempt(a => a + 1);

  // ─── Pantallas sin pregunta ─────────────────────────────
  if (loadError) {
    return (
      <Frame onBack={onBack}>
        <Info
          emoji="📶"
          title="No pudimos abrir el link"
          subtitle="Revisa tu conexión e intenta de nuevo."
          primary={{ label: 'Reintentar', onClick: () => { setLoadError(false); reload(); } }}
          secondary={{ label: 'Ir al inicio', onClick: onBack }}
        />
      </Frame>
    );
  }

  if (debt === undefined) {
    return (
      <Frame onBack={onBack}>
        <div className="flex flex-col items-center px-6 pt-6" aria-busy="true">
          <div className="w-[72px] h-[72px] rounded-full bg-gray-100 animate-pulse" />
          <div className="w-32 h-4 rounded bg-gray-100 animate-pulse mt-4" />
          <div className="w-40 h-11 rounded-xl bg-gray-100 animate-pulse mt-3" />
        </div>
      </Frame>
    );
  }

  if (!debt || debt.kind !== 'direct') {
    return (
      <Frame onBack={onBack}>
        <Info
          emoji="🔍"
          title="No encontramos esta deuda"
          subtitle="Revisa que el link esté completo, o pídele a tu amigo que te lo envíe otra vez."
          primary={{ label: 'Ir al inicio', onClick: onBack }}
        />
      </Frame>
    );
  }

  const lent = creatorLent(debt); // quien anotó prestó: tú eres quien debe
  const creator = (lent ? debt.creditor_name : debt.debtor_name) || 'Tu amigo';
  const amount = formatMoney(debt.amount_cents);
  const myTab: 'owe' | 'owed' = lent ? 'owe' : 'owed';

  // ─── Después de responder ───────────────────────────────
  if (outcome) {
    const copy: Record<Outcome, { title: string; subtitle: string }> = {
      paid: {
        title: `Le pagaste ${amount} a ${creator}`,
        subtitle: `Le avisamos a ${creator}. Tu saldo ahora es ${formatMoney(balance)}.`,
      },
      later: {
        title: `Anotado: le debes ${amount} a ${creator}`,
        subtitle: 'Lo verás en Mis deudas para pagarle en un toque cuando puedas.',
      },
      accepted: {
        title: `Listo: ${creator} te debe ${amount}`,
        subtitle: 'Lo verás en Mis deudas. Te avisaremos cuando te pague.',
      },
      declined: {
        title: `Le avisamos a ${creator}`,
        subtitle: 'Esta deuda no quedó anotada a tu nombre.',
      },
    };
    const showDebts = outcome === 'later' || outcome === 'accepted';
    return (
      <Frame onBack={onBack}>
        <Info
          check={outcome !== 'declined'}
          emoji="👍"
          title={copy[outcome].title}
          subtitle={copy[outcome].subtitle}
          note={actionError}
          primary={{ label: 'Listo', onClick: onBack }}
          secondary={showDebts ? { label: 'Ver Mis deudas', onClick: () => onOpenDebts(myTab) } : undefined}
        />
      </Frame>
    );
  }

  // Tu propio link (lo abriste para revisarlo o lo escaneaste tú mismo).
  if (debt.created_by === userId) {
    const friend = (lent ? debt.debtor_name : debt.creditor_name) || 'Tu amigo';
    const ownStatus: Record<Debt['status'], string> = {
      pending: 'Este es tu link. Envíaselo a tu amigo para que lo acepte.',
      active: `${friend} ya lo aceptó. Lo ves en Mis deudas.`,
      paid: lent ? `${friend} ya te pagó.` : `Ya le pagaste a ${friend}.`,
      forgiven: lent ? `Le perdonaste esta deuda a ${friend}.` : `${friend} te perdonó esta deuda.`,
      declined: `${friend} dijo que no reconoce esta deuda.`,
      cancelled: 'Anulaste este link.',
    };
    const toDebts = () => onOpenDebts(lent ? 'owed' : 'owe');
    return (
      <Frame onBack={onBack}>
        <DebtSummary debt={debt} lead={lent ? 'Te deben' : 'Debes'} positive={lent} />
        <p className="text-[14px] text-gray-600 text-center px-8 mt-4">{ownStatus[debt.status]}</p>
        <div className="mt-auto px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {debt.status === 'pending' ? (
            <>
              <DebtLinkActions debt={debt} />
              <SecondaryButton label="Ver Mis deudas" onClick={toDebts} />
            </>
          ) : (
            <PrimaryButton label="Ver Mis deudas" busy={false} onClick={toDebts} />
          )}
        </div>
      </Frame>
    );
  }

  if (debt.status === 'cancelled') {
    return (
      <Frame onBack={onBack}>
        <Info
          emoji="🗑️"
          title="Este link ya no está disponible"
          subtitle={`${creator} lo anuló, así que no hay nada que hacer aquí.`}
          primary={{ label: 'Ir al inicio', onClick: onBack }}
        />
      </Frame>
    );
  }

  if (debt.status !== 'pending') {
    const mine = debt.debtor_id === userId || debt.creditor_id === userId;
    if (!mine) {
      return (
        <Frame onBack={onBack}>
          <Info
            emoji="🔒"
            title="Este link ya lo usó otra persona"
            subtitle={`Si crees que es un error, pídele a ${creator} que te envíe uno nuevo.`}
            primary={{ label: 'Ir al inicio', onClick: onBack }}
          />
        </Frame>
      );
    }
    const resolved: Record<string, { emoji: string; title: string }> = {
      active: { emoji: '🧾', title: lent ? `Le debes ${amount} a ${creator}` : `${creator} te debe ${amount}` },
      paid: { emoji: '✅', title: 'Esta deuda ya está pagada' },
      forgiven: { emoji: '🤍', title: lent ? `${creator} te perdonó esta deuda` : 'Perdonaste esta deuda' },
      declined: { emoji: '👍', title: 'Ya le dijiste que no reconoces esta deuda' },
    };
    const state = resolved[debt.status] ?? resolved.paid;
    return (
      <Frame onBack={onBack}>
        <Info
          emoji={state.emoji}
          title={state.title}
          subtitle={debt.status === 'active' ? 'Está anotada en Mis deudas.' : 'No tienes nada pendiente con este link.'}
          primary={debt.status === 'active'
            ? { label: 'Ver Mis deudas', onClick: () => onOpenDebts(myTab) }
            : { label: 'Ir al inicio', onClick: onBack }}
        />
      </Frame>
    );
  }

  // ─── La pregunta ────────────────────────────────────────
  const respond = async (accept: boolean): Promise<Debt | null> => {
    if (!profile) return null;
    try {
      return await respondToDebtLink(token, profile.userId, profile.displayName, accept);
    } catch (err) {
      setSheet(null);
      setActionError(err instanceof Error ? err.message : 'No pudimos guardar tu respuesta');
      reload(); // quizá otro la tomó o la anularon: mostrar el estado real
      return null;
    }
  };

  const accept = async (outcomeOnSuccess: 'later' | 'accepted') => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    const done = await respond(true);
    setBusy(false);
    if (done) setOutcome(outcomeOnSuccess);
  };

  const decline = async () => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    const done = await respond(false);
    setBusy(false);
    if (done) {
      setSheet(null);
      setOutcome('declined');
    }
  };

  const payNow = async (topUpCents: number) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    const accepted = await respond(true);
    if (!accepted) {
      setBusy(false);
      return;
    }
    try {
      if (topUpCents > 0) add(topUpCents);
      await settleDebts([accepted.id]);
      deduct(accepted.amount_cents);
      trackEvent('DEBT_LINK_PAID_NOW', undefined, userId, { debtId: accepted.id, amountCents: accepted.amount_cents, topUpCents });
      setOutcome('paid');
    } catch {
      // La deuda ya quedó anotada: no se pierde, solo falta pagarla.
      setActionError('No pudimos completar el pago, pero quedó anotada. Págala desde Mis deudas.');
      setOutcome('later');
    } finally {
      setSheet(null);
      setBusy(false);
    }
  };

  return (
    <Frame onBack={onBack}>
      <DebtSummary
        debt={debt}
        lead={lent ? `${creator} te prestó` : `${creator} anotó que te debe`}
        positive={!lent}
        avatarName={creator}
      />

      <p className="text-[14px] text-gray-600 text-center leading-snug mx-6 mt-5 bg-[#F8F8FA] rounded-2xl px-4 py-3">
        {lent
          ? 'Págale ahora con tu saldo de Deuna, o déjalo anotado y le pagas cuando puedas.'
          : `Si es correcto, queda anotado en tus deudas y ${creator} te podrá pagar en un toque.`}
      </p>

      <div className="mt-auto px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        {actionError && (
          <p className="text-[13px] text-[#A32D2D] bg-[#FCEBEB] rounded-xl px-3 py-2 text-center mb-2">{actionError}</p>
        )}
        {lent ? (
          <>
            <PrimaryButton label={`Pagar ${amount}`} busy={false} onClick={() => setSheet('pay')} />
            <button
              onClick={() => accept('later')}
              disabled={busy}
              className="w-full py-3 mt-2.5 bg-white border-2 border-[#EBE3F5] rounded-[14px] active:scale-[0.98] transition-transform"
            >
              <span className="block text-[15px] font-bold text-[#4C1D80]">{busy ? 'Anotando…' : 'Pagar después'}</span>
              <span className="block text-[12px] text-gray-500">Queda anotado en Mis deudas</span>
            </button>
          </>
        ) : (
          <PrimaryButton label={`Sí, me debe ${amount}`} busy={busy} onClick={() => accept('accepted')} />
        )}
        <button
          onClick={() => setSheet('decline')}
          disabled={busy}
          className="w-full py-3 mt-1 text-[14px] font-semibold text-gray-500 active:opacity-70"
        >
          {lent ? `No le debo nada a ${creator}` : `${creator} no me debe nada`}
        </button>
      </div>

      {sheet === 'pay' && (
        <PayDebtSheet
          creditorName={creator}
          debts={[debt]}
          roomNames={{}}
          balanceCents={balance}
          busy={busy}
          onClose={() => setSheet(null)}
          onConfirm={payNow}
        />
      )}

      {sheet === 'decline' && (
        <BottomSheet onClose={() => setSheet(null)} dismissible={!busy} label="No reconozco esta deuda">
          <div className="flex flex-col items-center px-6 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3 bg-gray-100">
              <span className="text-[26px]" aria-hidden="true">🤔</span>
            </div>
            <h3 className="text-[19px] font-bold text-[#1a1a1a]">
              {lent ? `¿No le debes nada a ${creator}?` : `¿${creator} no te debe nada?`}
            </h3>
            <p className="text-[14px] text-gray-500 mt-2 mb-5 px-2">
              Le avisaremos a {creator} y esta deuda no quedará anotada a tu nombre.
            </p>
            <PrimaryButton label="Sí, avisarle" busy={busy} onClick={decline} />
            <button
              onClick={() => setSheet(null)}
              disabled={busy}
              className="w-full py-3 mt-1.5 rounded-[14px] font-bold text-[15px] text-gray-500 active:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </BottomSheet>
      )}
    </Frame>
  );
}

// ─── Piezas ──────────────────────────────────────────────────

function Frame({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      <div className="flex items-center px-5 pt-14 pb-2 shrink-0">
        <button onClick={onBack} aria-label="Ir al inicio" className="p-1 -ml-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}

function DebtSummary({
  debt,
  lead,
  positive,
  avatarName,
}: {
  debt: Debt;
  lead: string;
  positive: boolean;
  avatarName?: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 pt-4 text-center">
      {avatarName ? (
        <Avatar name={avatarName} size={72} />
      ) : (
        <div className="w-[72px] h-[72px] rounded-full bg-[#F3EDFB] flex items-center justify-center text-[32px]" aria-hidden="true">
          {conceptEmoji(debt.concept)}
        </div>
      )}
      <p className="text-[15px] text-gray-500 mt-3">{lead}</p>
      <p className={`text-[44px] font-black leading-tight tabular-nums ${positive ? 'text-[#3B6D11]' : 'text-[#1a1a1a]'}`}>
        {formatMoney(debt.amount_cents)}
      </p>
      <p className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full bg-[#F8F8FA] border border-gray-100 text-[13px] font-semibold text-[#1a1a1a]">
        <span aria-hidden="true">{conceptEmoji(debt.concept)}</span>
        {debt.concept || DEFAULT_DEBT_CONCEPT} · {relativeDate(debt.created_at)}
      </p>
    </div>
  );
}

function Info({
  emoji,
  check = false,
  title,
  subtitle,
  note,
  primary,
  secondary,
}: {
  emoji: string;
  check?: boolean;
  title: string;
  subtitle: string;
  note?: string | null;
  primary: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <>
      <div className="flex flex-col items-center px-8 pt-10 text-center">
        {check ? (
          <div className="mitimiti-check mb-4">
            <div className="w-20 h-20 bg-[#2FD9A9] rounded-full flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-[36px]" aria-hidden="true">{emoji}</span>
          </div>
        )}
        <h2 className="text-[21px] font-bold text-[#1a1a1a] leading-snug">{title}</h2>
        <p className="text-[14px] text-gray-500 mt-2 leading-snug">{subtitle}</p>
        {note && (
          <p className="text-[13px] text-[#A32D2D] bg-[#FCEBEB] rounded-xl px-3 py-2 mt-4">{note}</p>
        )}
      </div>
      <div className="mt-auto px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <PrimaryButton label={primary.label} busy={false} onClick={primary.onClick} />
        {secondary && <SecondaryButton label={secondary.label} onClick={secondary.onClick} />}
      </div>
    </>
  );
}

function PrimaryButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`w-full py-4 rounded-[14px] text-[16px] font-bold text-white flex items-center justify-center gap-2 transition-all ${
        busy ? 'bg-[#4C1D80]/70 cursor-wait' : 'bg-[#4C1D80] active:scale-[0.98]'
      }`}
    >
      {busy && (
        <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      )}
      {busy ? 'Guardando…' : label}
    </button>
  );
}

function SecondaryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 mt-1.5 rounded-[14px] text-[15px] font-bold text-[#4C1D80] active:bg-gray-50"
    >
      {label}
    </button>
  );
}
