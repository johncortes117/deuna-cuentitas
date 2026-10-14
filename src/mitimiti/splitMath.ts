// ─── Reparto con auto-balance (lógica pura, sin React) ───────
//
// El problema del "Personalizar" anterior: al cambiar el monto de una
// persona la suma dejaba de cuadrar y el host tenía que hacer la cuenta a
// mano para corregir a los demás ("Faltan $3 por asignar"). Justo la
// calculadora que MitiMiti promete quitar.
//
// Aquí la suma SIEMPRE cuadra sola:
//   1. Lo que el host toca queda fijo ("touched").
//   2. Lo que falta para el total se reparte en partes iguales entre los que
//      NO tocó ("libres").
//   3. Siempre queda al menos una persona libre que absorbe la diferencia:
//      si el host toca a la última libre, se libera la que tocó hace más
//      tiempo. Con 2 personas: cambias a una y la otra se ajusta sola.
//   4. Si lo fijado ya supera el total, se liberan las más antiguas hasta que
//      cuadre. Solo si UN monto por sí solo supera la cuenta queda un exceso
//      ("Te pasaste por $X") que el host tiene que corregir.
//
// Todo en centavos enteros. Los centavos sobrantes van a los primeros de la
// lista (determinístico: los montos no "bailan" mientras el host escribe).

export interface SplitState {
  amounts: Record<string, number>; // centavos por userId
  touched: string[];               // userIds fijados a mano, del más antiguo al más reciente
}

/** Reparte `cents` en partes iguales entre `ids`. */
export function spreadEvenly(cents: number, ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (ids.length === 0) return out;
  const total = Math.max(0, cents);
  const base = Math.floor(total / ids.length);
  let extra = total - base * ids.length;
  for (const id of ids) {
    out[id] = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
  }
  return out;
}

export function equalSplit(totalCents: number, ids: string[]): SplitState {
  return { amounts: spreadEvenly(totalCents, ids), touched: [] };
}

/**
 * Recalcula a los libres a partir de los fijos. También adapta el estado si
 * cambió la gente de la sala (alguien entró o salió con la hoja abierta):
 * quien entra llega como libre y quien sale deja de contar.
 */
export function rebalance(state: SplitState, ids: string[], totalCents: number): SplitState {
  const touched = state.touched.filter(id => ids.includes(id));
  const free = ids.filter(id => !touched.includes(id));
  const fixedSum = touched.reduce((acc, id) => acc + (state.amounts[id] ?? 0), 0);
  const spread = spreadEvenly(totalCents - fixedSum, free);

  const amounts: Record<string, number> = {};
  for (const id of ids) {
    amounts[id] = touched.includes(id) ? (state.amounts[id] ?? 0) : (spread[id] ?? 0);
  }
  return { amounts, touched };
}

/** Fija el monto de una persona y reparte el resto solo (reglas arriba). */
export function setAmount(
  state: SplitState,
  ids: string[],
  totalCents: number,
  userId: string,
  cents: number,
): SplitState {
  const value = Math.max(0, Math.round(cents));
  const amounts = { ...state.amounts, [userId]: value };
  // userId pasa a ser el más reciente; queda al final y nunca se libera.
  let touched = [...state.touched.filter(id => id !== userId && ids.includes(id)), userId];

  // Regla 3: siempre al menos una persona libre.
  if (ids.length > 1 && touched.length >= ids.length) {
    touched = touched.slice(1);
  }

  // Regla 4: si lo fijado supera el total, se liberan los más antiguos.
  const fixedSum = () => touched.reduce((acc, id) => acc + (amounts[id] ?? 0), 0);
  while (touched.length > 1 && fixedSum() > totalCents) {
    touched = touched.slice(1);
  }

  return rebalance({ amounts, touched }, ids, totalCents);
}

/** Devuelve a una persona al reparto automático. */
export function releaseAmount(
  state: SplitState,
  ids: string[],
  totalCents: number,
  userId: string,
): SplitState {
  return rebalance({ ...state, touched: state.touched.filter(id => id !== userId) }, ids, totalCents);
}

/** total − suma: > 0 faltan, < 0 sobran (te pasaste), 0 cuadra. */
export function splitDifference(state: SplitState, ids: string[], totalCents: number): number {
  return totalCents - ids.reduce((acc, id) => acc + (state.amounts[id] ?? 0), 0);
}

/**
 * Paso de los botones −/+: lleva al dólar entero más cercano en esa dirección
 * y de ahí avanza de a $1 ($16,67 → + → $17,00 → + → $18,00).
 */
export function stepCents(cents: number, direction: 1 | -1): number {
  if (direction > 0) return Math.floor(cents / 100) * 100 + 100;
  return cents % 100 === 0 ? Math.max(0, cents - 100) : Math.floor(cents / 100) * 100;
}
