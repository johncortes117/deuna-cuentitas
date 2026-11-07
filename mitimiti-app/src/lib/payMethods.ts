// ─── Formas de cobro ─────────────────────────────────────────
// En Ecuador casi todo se paga en efectivo o por transferencia, y cada vez
// hay que pedir "pásame tus datos" (banco, tipo de cuenta, número, cédula).
// MitiMiti los guarda una vez y los muestra con un botón para copiar.
import type { PayMethod, PayMethodType } from './types'

export const BANKS = [
  'Banco Pichincha',
  'Banco Guayaquil',
  'Produbanco',
  'Banco del Pacífico',
  'Banco Internacional',
  'Banco Bolivariano',
  'Banco del Austro',
  'Banco de Machala',
  'Banco General Rumiñahui',
  'Banco de Loja',
  'Banco Solidario',
  'Banco ProCredit',
  'Banco Diners Club',
  'Banco Amazonas',
  'Banco Capital',
  'BanEcuador',
  'Cooperativa JEP',
  'Cooperativa 29 de Octubre',
  'Cooperativa Policía Nacional',
  'Cooperativa Alianza del Valle',
  'Mutualista Pichincha',
]

export const ACCOUNT_TYPES = [
  { value: 'ahorros', label: 'Ahorros' },
  { value: 'corriente', label: 'Corriente' },
]

export const METHOD_LABEL: Record<PayMethodType, string> = {
  deuna: 'Deuna',
  transfer: 'Transferencia',
  payphone: 'Payphone',
  cash: 'Efectivo',
  other: 'Otro',
}

/** Para usar dentro de una frase: "pagaste por transferencia", "en efectivo". */
export const PAID_VIA: Record<PayMethodType, string> = {
  deuna: 'por Deuna',
  transfer: 'por transferencia',
  payphone: 'por Payphone',
  cash: 'en efectivo',
  other: 'por otro medio',
}

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Cómo se pagó (lo que elige quien avisa "ya te pagué"). */
export const PAID_WITH: { value: PayMethodType; label: string }[] = [
  { value: 'transfer', label: 'Transferencia' },
  { value: 'deuna', label: 'Deuna' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'payphone', label: 'Payphone' },
  { value: 'other', label: 'Otro' },
]

/** El detalle sin repetir el tipo (cuando el título ya dice "Deuna"). */
export function methodDetail(m: PayMethod): string {
  switch (m.type) {
    case 'deuna':
    case 'payphone':
      return prettyPhone(m.phone)
    case 'transfer':
      return `${m.bank} · ${m.account_type === 'corriente' ? 'Corriente' : 'Ahorros'} ···${m.account_number.slice(-4)}`
    case 'cash':
      return 'Te pueden pagar en persona'
    case 'other':
      return `${m.label} · ${m.value}`
  }
}

export function accountTypeLabel(value: string): string {
  return value === 'corriente' ? 'Cuenta corriente' : 'Cuenta de ahorros'
}

/** Cédula ecuatoriana (10 dígitos con dígito verificador) o RUC (13). */
export function idNumberKind(value: string): 'cedula' | 'ruc' | 'passport' | 'invalid' | 'empty' {
  const v = value.replace(/\s|-/g, '')
  if (!v) return 'empty'
  if (/^\d{10}$/.test(v)) return isValidCedula(v) ? 'cedula' : 'invalid'
  if (/^\d{13}$/.test(v)) return v.endsWith('001') && (isValidCedula(v.slice(0, 10)) || Number(v[2]) >= 6) ? 'ruc' : 'invalid'
  if (/^[A-Za-z0-9]{6,15}$/.test(v)) return 'passport'
  return 'invalid'
}

export function isValidCedula(v: string): boolean {
  if (!/^\d{10}$/.test(v)) return false
  const province = Number(v.slice(0, 2))
  if (!((province >= 1 && province <= 24) || province === 30)) return false
  if (Number(v[2]) >= 6) return false
  const sum = v
    .slice(0, 9)
    .split('')
    .reduce((acc, d, i) => {
      let n = Number(d) * (i % 2 === 0 ? 2 : 1)
      if (n > 9) n -= 9
      return acc + n
    }, 0)
  return (10 - (sum % 10)) % 10 === Number(v[9])
}

export function isValidPhone(value: string): boolean {
  return /^0?9\d{8}$/.test(value.replace(/\s|-/g, '')) || /^\+?\d{8,15}$/.test(value.replace(/\s|-/g, ''))
}

/** "0991234567" → "099 123 4567" */
export function prettyPhone(value: string): string {
  const v = value.replace(/\s|-/g, '')
  return /^09\d{8}$/.test(v) ? `${v.slice(0, 3)} ${v.slice(3, 6)} ${v.slice(6)}` : value
}

/** Una línea para listas: "Banco Pichincha · Ahorros ···4567". */
export function methodSummary(m: PayMethod): string {
  switch (m.type) {
    case 'deuna':
    case 'payphone':
      return `${METHOD_LABEL[m.type]} · ${prettyPhone(m.phone)}`
    case 'transfer':
      return `${m.bank} · ${m.account_type === 'corriente' ? 'Corriente' : 'Ahorros'} ···${m.account_number.slice(-4)}`
    case 'cash':
      return 'Efectivo'
    case 'other':
      return `${m.label}${m.value ? ` · ${m.value}` : ''}`
  }
}

/** El texto que se copia para pagar (listo para pegar en la app del banco). */
export function methodCopyText(m: PayMethod): string {
  switch (m.type) {
    case 'deuna':
    case 'payphone':
      return m.phone
    case 'transfer':
      return [
        `${m.bank} · ${accountTypeLabel(m.account_type)}`,
        `N.º ${m.account_number}`,
        m.holder,
        m.id_number ? `C.I./RUC ${m.id_number}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    case 'cash':
      return 'Efectivo'
    case 'other':
      return m.value || m.label
  }
}

/** ¿Está completa? (para no guardar una cuenta bancaria sin número). */
export function isMethodComplete(m: PayMethod): boolean {
  switch (m.type) {
    case 'deuna':
    case 'payphone':
      return isValidPhone(m.phone)
    case 'transfer':
      return Boolean(m.bank.trim() && /^\d{5,20}$/.test(m.account_number.replace(/\s|-/g, '')) && m.holder.trim())
    case 'cash':
      return true
    case 'other':
      return Boolean(m.label.trim() && m.value.trim())
  }
}

/** Primero lo más rápido de pagar: Deuna, Payphone, transferencia, otros, efectivo. */
export function sortMethods(methods: PayMethod[]): PayMethod[] {
  const order: PayMethodType[] = ['deuna', 'payphone', 'transfer', 'other', 'cash']
  return [...methods].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
}
