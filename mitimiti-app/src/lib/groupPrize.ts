// ─── Micro-premio del recibo grupal ──────────────────────────
// Un solo reconocimiento positivo por cuenta cerrada, el primero que se
// cumpla en este orden. Nunca se señala a quien pagó último.

export interface PrizeInput {
  /** Préstamos (acolites) dentro de la cuenta. La app propia hoy no tiene. */
  loans: { helperName: string; cents: number }[]
  /** El primer pago confirmado: quién y cuántos segundos después de dividir. */
  firstPayment: { name: string; seconds: number } | null
  splitMode: 'equal' | 'amounts' | 'items'
  /** Desde que se creó la cuenta hasta que quedó cuadrada. */
  totalSeconds: number | null
}

export interface Prize {
  icon: string
  label: string
  value: string
}

/** "28 seg", "2 min", "2 min 10 seg". */
export function shortElapsed(seconds: number): string {
  const s = Math.max(1, Math.round(seconds))
  if (s < 60) return `${s} seg`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r === 0 || m >= 10 ? `${m} min` : `${m} min ${r} seg`
}

export function groupPrize(input: PrizeInput): Prize | null {
  if (input.loans.length > 0) {
    const top = [...input.loans].sort((a, b) => b.cents - a.cents)[0]
    return { icon: '🤝', label: 'El que acolitó', value: top.helperName }
  }
  if (input.firstPayment && input.firstPayment.seconds >= 0 && input.firstPayment.seconds < 5 * 60) {
    return { icon: '⚡', label: 'Pagó al toque', value: `${input.firstPayment.name} (${shortElapsed(input.firstPayment.seconds)})` }
  }
  if (input.splitMode === 'items' || input.splitMode === 'amounts') {
    return { icon: '🎯', label: 'Cuadró al centavo', value: 'Sin sacar calculadora' }
  }
  if (input.totalSeconds !== null && input.totalSeconds >= 0 && input.totalSeconds < 3 * 60) {
    return { icon: '🏁', label: 'Cuadrado al toque', value: 'Todos al día en tiempo récord' }
  }
  return null
}

/** Cuánto tardó toda la cuenta: "1 min 40 seg", "12 min", "Mismo día", "3 días". */
export function groupElapsedLabel(fromIso: string, toIso: string): string {
  const from = new Date(fromIso)
  const to = new Date(toIso)
  const seconds = Math.max(0, (to.getTime() - from.getTime()) / 1000)
  if (seconds < 3600) return shortElapsed(seconds)
  if (from.toDateString() === to.toDateString()) return 'Mismo día'
  const days = Math.max(1, Math.round(seconds / 86_400))
  return days === 1 ? '1 día' : `${days} días`
}

/** "Ana · Luis · Carla · Pedro" o, desde 5 personas, "Ana · Luis · Carla y +2 más". */
export function participantsLine(names: string[]): string {
  if (names.length <= 4) return names.join(' · ')
  return `${names.slice(0, 3).join(' · ')} y +${names.length - 3} más`
}
