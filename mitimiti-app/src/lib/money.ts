// ─── Dinero ──────────────────────────────────────────────────
// Siempre en centavos enteros. Se muestra como en Ecuador: "$1.234,50".

const formatters = new Map<string, Intl.NumberFormat>()

function formatter(currency: string): Intl.NumberFormat {
  let f = formatters.get(currency)
  if (!f) {
    f = new Intl.NumberFormat('es-EC', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    formatters.set(currency, f)
  }
  return f
}

/** 150 → "$1,50" · 123450 → "$1.234,50" */
export function formatMoney(cents: number, currency = 'USD'): string {
  return formatter(currency).format(cents / 100)
}

/** Sin decimales cuando son ",00": para montos grandes y redondos en títulos. */
export function formatMoneyShort(cents: number, currency = 'USD'): string {
  if (cents % 100 !== 0) return formatMoney(cents, currency)
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100)
}

// ─── Teclado numérico propio ──────────────────────────────────
// El monto se escribe como texto ("12,5") para no perder lo que la persona
// está tecleando (la coma sola, el cero final) y se convierte al final.

export const MAX_INTEGER_DIGITS = 6 // hasta $999.999

export function keypadInput(current: string, key: string, maxInteger = MAX_INTEGER_DIGITS): string {
  if (key === 'del') return current.length <= 1 ? '0' : current.slice(0, -1)
  if (key === ',') return current.includes(',') ? current : `${current},`
  if (!/^\d$/.test(key)) return current
  const [int, dec] = current.split(',')
  if (dec !== undefined) return dec.length >= 2 ? current : current + key
  if (int === '0') return key
  return int.length >= maxInteger ? current : current + key
}

/** "12,5" → 1250 · "0" → 0 */
export function inputToCents(input: string): number {
  const [int, dec = ''] = input.split(',')
  const cents = Number(int || '0') * 100 + Number((dec + '00').slice(0, 2))
  return Number.isFinite(cents) ? cents : 0
}

/** 1250 → "12,5" · 1200 → "12" · 1205 → "12,05" (para editar un monto existente) */
export function centsToInput(cents: number): string {
  const int = Math.floor(cents / 100)
  const dec = cents % 100
  if (dec === 0) return String(int)
  return `${int},${String(dec).padStart(2, '0').replace(/0$/, '')}`
}

/** Para mostrar mientras se escribe: "12,5" → "12,5" con separador de miles. */
export function prettyInput(input: string): string {
  const [int, dec] = input.split(',')
  const grouped = Number(int || '0').toLocaleString('es-EC')
  return dec === undefined ? grouped : `${grouped},${dec}`
}

/** Porcentaje de un monto, redondeado al centavo. */
export function percentOf(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100)
}

/**
 * Precio escrito a mano ("4,50", "4.50", "$12", "1.234,50") → centavos.
 * null si no se entiende. Con punto y coma juntos, el punto es de miles.
 */
export function parsePrice(raw: string): number | null {
  let v = raw.replace(/[$\s]/g, '')
  if (!v) return null
  if (v.includes(',') && v.includes('.')) v = v.replace(/\./g, '').replace(',', '.')
  else if (v.includes(',')) v = v.replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null
  const cents = Math.round(Number(v) * 100)
  return cents > 0 && cents <= 100_000_000 ? cents : null
}
