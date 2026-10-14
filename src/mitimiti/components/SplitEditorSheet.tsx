// ─── SplitEditorSheet: "Montos diferentes" con auto-reparto ──
//
// Reemplaza al antiguo "Personalizar" (un switch de modo + inputs libres donde
// el host tenía que cuadrar la suma a mano). Aquí:
//   • No hay modos: se abre con el reparto igual y cada monto se toca directo.
//   • Al cambiar un monto, lo que falta se reparte SOLO entre los demás
//     (ver splitMath.ts): la suma cuadra siempre, sin calculadora.
//   • −/+ de a $1 para el ajuste típico ("yo pongo un dólar más") sin teclear.
//   • Para un monto exacto se usa el teclado propio de la app — el mismo de
//     "¿Cuánto es la cuenta?" — en vez del teclado del sistema, que tapaba la
//     hoja y obligaba a borrar el "12,00" que ya estaba escrito.
import { useState, useRef, useEffect } from 'react';
import type { Participant } from '../types';
import { formatMoney, toCents } from '../utils';
import {
  equalSplit,
  rebalance,
  setAmount,
  releaseAmount,
  splitDifference,
  stepCents,
  type SplitState,
} from '../splitMath';
import BottomSheet, { SheetCloseButton } from './BottomSheet';
import Avatar from './Avatar';

interface SplitEditorSheetProps {
  participants: Participant[];
  totalCents: number;
  myUserId: string;
  // 'new': la cuenta todavía no se divide. 'correct': ya se dividió y el
  // host corrige montos (todos vuelven a aceptar).
  mode: 'new' | 'correct';
  busy: boolean;
  onClose: () => void;
  onConfirm: (amounts: { userId: string; amountCents: number }[], isEqual: boolean) => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'];

function initialSplit(participants: Participant[], totalCents: number, mode: 'new' | 'correct'): SplitState {
  const ids = participants.map(p => p.user_id);
  const equal = equalSplit(totalCents, ids);
  if (mode !== 'correct' || participants.some(p => p.amount_cents === null)) return equal;

  // Si ya estaba dividido en partes iguales, arrancamos igual que siempre.
  const current = participants.map(p => p.amount_cents ?? 0);
  const sortedCurrent = [...current].sort((a, b) => a - b).join(',');
  const sortedEqual = Object.values(equal.amounts).sort((a, b) => a - b).join(',');
  if (sortedCurrent === sortedEqual) return equal;

  // Si eran montos diferentes, se respetan tal cual: todos quedan fijos
  // menos el último, que es quien absorbe el próximo cambio.
  return {
    amounts: Object.fromEntries(participants.map(p => [p.user_id, p.amount_cents ?? 0])),
    touched: ids.slice(0, -1),
  };
}

export default function SplitEditorSheet({
  participants,
  totalCents,
  myUserId,
  mode,
  busy,
  onClose,
  onConfirm,
}: SplitEditorSheetProps) {
  const ids = participants.map(p => p.user_id);
  const [split, setSplit] = useState<SplitState>(() => initialSplit(participants, totalCents, mode));
  // Al corregir, guardar sin tocar nada haría que todos vuelvan a aceptar
  // por nada: el botón se activa recién cuando el host cambia algo.
  const [dirty, setDirty] = useState(false);
  // Fila que se está escribiendo con el teclado. `draft` vacío = todavía no
  // tecleó nada (el monto anterior se muestra en gris como guía).
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // El estado guardado se adapta a quien entre o salga con la hoja abierta.
  const committed = rebalance(split, ids, totalCents);
  // Mientras se escribe, la vista previa se calcula SIEMPRE desde lo guardado
  // (no tecla a tecla): un "150" de paso no borra otros montos fijados si
  // después se corrige a "15".
  const view = editing && editing.draft !== ''
    ? setAmount(committed, ids, totalCents, editing.id, toCents(editing.draft))
    : committed;

  const diff = splitDifference(view, ids, totalCents);
  const anyTouched = view.touched.length > 0;
  const enoughPeople = ids.length >= 2;
  const changed = mode === 'new' || dirty;
  const canConfirm = diff === 0 && enoughPeople && changed && !busy;

  // Al abrir el teclado la lista se achica: que la fila editada siga a la vista.
  const editingId = editing?.id;
  useEffect(() => {
    if (!editingId) return;
    const timer = setTimeout(() => {
      rowRefs.current[editingId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 80);
    return () => clearTimeout(timer);
  }, [editingId]);

  // Guarda lo que se estaba escribiendo y devuelve el estado resultante, para
  // que la acción siguiente (−/+, deshacer, cobrar) parta de ahí.
  const commitEdit = (): SplitState => {
    if (editing) {
      setSplit(view);
      setEditing(null);
    }
    return view;
  };

  const startEdit = (id: string) => {
    if (busy) return;
    commitEdit();
    setEditing({ id, draft: '' });
  };

  const pressKey = (key: string) => {
    if (!editing) return;
    const draft = editing.draft;
    let next: string;
    if (key === 'del') {
      next = draft.slice(0, -1);
    } else if (key === ',') {
      if (draft.includes(',')) return;
      next = (draft === '' ? '0' : draft) + ',';
    } else {
      const [intPart, decPart] = draft.split(',');
      if (decPart !== undefined && decPart.length >= 2) return;
      if (decPart === undefined && intPart.length >= 5) return;
      next = draft === '0' ? key : draft + key;
    }
    setEditing({ ...editing, draft: next });
    if (next !== '') setDirty(true);
  };

  const step = (id: string, direction: 1 | -1) => {
    if (busy) return;
    const base = commitEdit();
    const current = base.amounts[id] ?? 0;
    const next = Math.min(totalCents, stepCents(current, direction));
    if (next !== current) {
      setSplit(setAmount(base, ids, totalCents, id, next));
      setDirty(true);
    }
  };

  const release = (id: string) => {
    const base = commitEdit();
    setSplit(releaseAmount(base, ids, totalCents, id));
    setDirty(true);
  };

  const resetAll = () => {
    setEditing(null);
    setSplit(equalSplit(totalCents, ids));
    setDirty(true);
  };

  const confirm = () => {
    const final = commitEdit();
    if (splitDifference(final, ids, totalCents) !== 0 || !enoughPeople || !changed || busy) return;
    onConfirm(
      ids.map(id => ({ userId: id, amountCents: final.amounts[id] ?? 0 })),
      final.touched.length === 0,
    );
  };

  const confirmLabel = busy
    ? 'Guardando…'
    : mode === 'correct'
      ? 'Guardar montos'
      : anyTouched ? 'Cobrar estos montos' : 'Dividir en partes iguales';

  return (
    <BottomSheet onClose={onClose} dismissible={!busy} label="¿Cuánto paga cada uno?">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3 px-5 pt-1 pb-3 shrink-0">
        <div>
          <h2 className="text-[20px] font-bold text-[#1a1a1a] leading-tight">¿Cuánto paga cada uno?</h2>
          <p className="text-[14px] text-gray-500 mt-0.5">
            Cuenta total: <span className="font-semibold text-[#1a1a1a]">{formatMoney(totalCents)}</span>
          </p>
        </div>
        <SheetCloseButton onClick={onClose} />
      </div>

      {/* Cómo funciona, en una línea */}
      <div className="mx-5 mb-2 px-3.5 py-2.5 bg-[#F6F1FD] rounded-2xl flex gap-2.5 items-start shrink-0">
        <span className="text-[15px] leading-none mt-0.5" aria-hidden="true">💡</span>
        <p className="text-[13px] text-[#4C1D80] leading-snug">
          Toca un monto para cambiarlo. Lo que falte se reparte solo entre los demás.
        </p>
      </div>

      {/* Personas */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-1">
        {participants.map(p => {
          const id = p.user_id;
          const amount = view.amounts[id] ?? 0;
          const isEditing = editing?.id === id;
          const isTouched = view.touched.includes(id);

          return (
            <div
              key={p.id}
              ref={el => { rowRefs.current[id] = el; }}
              className={`flex items-center gap-3 px-2.5 py-2.5 rounded-2xl transition-colors ${isEditing ? 'bg-[#F6F1FD]' : ''}`}
            >
              <Avatar name={p.display_name} size={40} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[15px] font-semibold text-[#1a1a1a] truncate">{p.display_name}</span>
                  {id === myUserId && (
                    <span className="text-[10px] font-bold text-[#4C1D80] bg-[#EEEDFE] px-1.5 py-0.5 rounded shrink-0">Tú</span>
                  )}
                </div>
                {isEditing ? (
                  <p className="text-[12px] font-medium text-[#4C1D80]">Escribe cuánto paga</p>
                ) : isTouched ? (
                  // El monto en morado ya dice "lo cambiaste"; aquí solo la
                  // salida, corta para que no parta la fila en dos líneas.
                  <button
                    onClick={() => release(id)}
                    aria-label={`Deshacer el cambio de ${p.display_name}`}
                    className="text-[12px] font-semibold text-[#4C1D80] py-1 -my-1 active:opacity-60"
                  >
                    ↺ Deshacer
                  </button>
                ) : anyTouched ? (
                  <p className="text-[12px] text-gray-500">Se ajusta solo</p>
                ) : null}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <StepButton
                  label={`Un dólar menos para ${p.display_name}`}
                  disabled={busy || amount === 0}
                  onClick={() => step(id, -1)}
                >
                  −
                </StepButton>
                <button
                  onClick={() => startEdit(id)}
                  aria-label={`Escribir el monto de ${p.display_name}`}
                  className={`min-w-[86px] h-10 px-2 rounded-xl text-[16px] font-bold tabular-nums transition-colors ${
                    isEditing
                      ? 'bg-white ring-2 ring-[#4C1D80] text-[#4C1D80]'
                      : isTouched
                        ? 'bg-[#EEEDFE] text-[#4C1D80]'
                        : 'bg-[#F4F4F6] text-[#1a1a1a]'
                  }`}
                >
                  {isEditing ? (
                    editing.draft === '' ? (
                      <>
                        <span className="text-gray-400">{formatMoney(amount)}</span>
                        <span className="mitimiti-caret" />
                      </>
                    ) : (
                      <>
                        ${editing.draft}
                        <span className="mitimiti-caret" />
                      </>
                    )
                  ) : (
                    <span
                      key={amount}
                      className={!isTouched && anyTouched ? 'mitimiti-amount-pop rounded-md px-1' : ''}
                    >
                      {formatMoney(amount)}
                    </span>
                  )}
                </button>
                <StepButton
                  label={`Un dólar más para ${p.display_name}`}
                  disabled={busy || amount >= totalCents}
                  onClick={() => step(id, 1)}
                >
                  +
                </StepButton>
              </div>
            </div>
          );
        })}
      </div>

      {editing ? (
        // Teclado propio (mismo que "¿Cuánto es la cuenta?")
        <div className="px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-gray-100 shrink-0 bg-white">
          <div className="grid grid-cols-3 gap-1 mb-2">
            {KEYS.map(key => (
              <button
                key={key}
                onClick={() => pressKey(key)}
                aria-label={key === 'del' ? 'Borrar' : key}
                className="h-12 flex items-center justify-center rounded-xl text-[24px] font-semibold text-[#4C1D80] active:bg-gray-100 transition-colors"
              >
                {key === 'del' ? (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4C1D80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                    <line x1="18" y1="9" x2="12" y2="15" />
                    <line x1="12" y1="9" x2="18" y2="15" />
                  </svg>
                ) : key}
              </button>
            ))}
          </div>
          <button
            onClick={() => commitEdit()}
            className="w-full py-3.5 rounded-[14px] bg-[#4C1D80] text-white text-[16px] font-bold active:scale-[0.98] transition-transform"
          >
            Listo
          </button>
        </div>
      ) : (
        <div className="px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-gray-100 shrink-0 bg-white">
          {!enoughPeople ? (
            <p className="text-[13px] font-semibold text-amber-700 text-center mb-3">
              Necesitas al menos 2 personas en la sala
            </p>
          ) : (
            <SumStatus diff={diff} totalCents={totalCents} />
          )}
          {mode === 'correct' && (
            <p className="text-[12px] text-gray-500 text-center -mt-1 mb-2.5">
              {changed
                ? 'Al guardar, cada uno vuelve a aceptar su parte.'
                : 'Cambia algún monto para poder guardar.'}
            </p>
          )}
          <button
            onClick={confirm}
            disabled={!canConfirm}
            className={`w-full py-4 rounded-[14px] text-[16px] font-bold transition-all ${
              canConfirm
                ? 'bg-[#4C1D80] text-white active:scale-[0.98]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {confirmLabel}
          </button>
          {anyTouched && (
            <button
              onClick={resetAll}
              disabled={busy}
              className="w-full py-2.5 mt-1 text-[14px] font-semibold text-[#4C1D80] active:opacity-70"
            >
              Volver a partes iguales
            </button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function SumStatus({ diff, totalCents }: { diff: number; totalCents: number }) {
  if (diff === 0) {
    return (
      <p className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-[#3B6D11] mb-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Suman {formatMoney(totalCents)}: cuadra con la cuenta
      </p>
    );
  }
  if (diff < 0) {
    return (
      <p className="text-[13px] font-semibold text-[#A32D2D] text-center mb-3">
        Te pasaste por {formatMoney(-diff)}. Baja algún monto.
      </p>
    );
  }
  return (
    <p className="text-[13px] font-semibold text-amber-700 text-center mb-3">
      Faltan {formatMoney(diff)} por repartir.
    </p>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-10 h-10 rounded-full border border-[#E2DCEC] text-[#4C1D80] text-[22px] font-bold leading-none flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30 disabled:active:scale-100"
    >
      {children}
    </button>
  );
}
