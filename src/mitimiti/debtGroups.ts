// ─── Deudas agrupadas por persona (lógica pura) ──────────────
// La gente piensa en personas, no en registros: "Diego me debe $22", no
// "tengo dos deudas de Diego en dos salas". Antes cada sala era una tarjeta
// aparte y el inicio contaba deudas como si fueran personas.
import type { Debt } from './types';

export interface PersonDebts {
  personId: string;
  name: string;
  direction: 'owe' | 'owed'; // owe: le debo yo · owed: me debe a mí
  totalCents: number;
  debts: Debt[];             // de la más reciente a la más antigua
  oldestAt: string;
}

/**
 * Agrupa deudas activas por la otra persona. `debts` debe venir ya filtrado
 * por dirección (todas "debes" o todas "te deben").
 */
export function groupDebtsByPerson(debts: Debt[], userId: string): PersonDebts[] {
  const groups = new Map<string, PersonDebts>();

  for (const debt of debts) {
    const iOwe = debt.debtor_id === userId;
    const personId = iOwe ? debt.creditor_id : debt.debtor_id;
    const name = iOwe ? debt.creditor_name : debt.debtor_name;
    const group = groups.get(personId);
    if (group) {
      group.totalCents += debt.amount_cents;
      group.debts.push(debt);
      if (debt.created_at < group.oldestAt) group.oldestAt = debt.created_at;
    } else {
      groups.set(personId, {
        personId,
        name,
        direction: iOwe ? 'owe' : 'owed',
        totalCents: debt.amount_cents,
        debts: [debt],
        oldestAt: debt.created_at,
      });
    }
  }

  const result = [...groups.values()];
  result.forEach(g => g.debts.sort((a, b) => b.created_at.localeCompare(a.created_at)));
  // Primero a quien más le debes / quien más te debe; a igual monto, la más vieja.
  result.sort((a, b) => b.totalCents - a.totalCents || a.oldestAt.localeCompare(b.oldestAt));
  return result;
}

/** Cantidad de personas distintas (para "3 personas" en el inicio). */
export function countPeople(debts: Debt[], userId: string): number {
  return new Set(debts.map(d => (d.debtor_id === userId ? d.creditor_id : d.debtor_id))).size;
}
