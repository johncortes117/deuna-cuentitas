// Nombres de cuenta sugeridos: casi siempre basta con tocar uno.
export const BILL_TITLES = [
  { emoji: '🍳', label: 'Desayuno' },
  { emoji: '🍔', label: 'Almuerzo' },
  { emoji: '☕', label: 'Café' },
  { emoji: '🍽️', label: 'Cena' },
  { emoji: '🍕', label: 'Pizza' },
  { emoji: '🍻', label: 'Bar' },
  { emoji: '🎂', label: 'Cumpleaños' },
  { emoji: '🛒', label: 'Supermercado' },
  { emoji: '🚕', label: 'Taxi' },
  { emoji: '✈️', label: 'Viaje' },
  { emoji: '🏠', label: 'Casa' },
  { emoji: '🎬', label: 'Cine' },
]

// Para qué fue un préstamo anotado a mano.
export const LOAN_CONCEPTS = [
  { emoji: '🍔', label: 'Comida' },
  { emoji: '🚕', label: 'Taxi' },
  { emoji: '🛒', label: 'Compras' },
  { emoji: '🚌', label: 'Pasaje' },
  { emoji: '📱', label: 'Recarga' },
  { emoji: '🎟️', label: 'Entradas' },
  { emoji: '⛽', label: 'Gasolina' },
]

export function titleEmoji(title: string | null | undefined): string {
  const t = (title ?? '').trim().toLowerCase()
  return [...BILL_TITLES, ...LOAN_CONCEPTS].find((x) => x.label.toLowerCase() === t)?.emoji ?? '🧾'
}
