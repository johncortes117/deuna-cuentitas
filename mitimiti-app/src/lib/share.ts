// ─── Compartir: WhatsApp primero ─────────────────────────────
// WhatsApp es donde ya está la conversación con los amigos. Cada mensaje lleva
// un link de vuelta a MitiMiti: cada cuenta, recordatorio o préstamo también
// es una invitación para quien todavía no la usa.
import { APP_URL } from './env'
import { formatMoney } from './money'
import { firstName } from './avatar'

export const billLink = (code: string) => `${APP_URL}/c/${code}`
export const debtLink = (token: string) => `${APP_URL}/d/${token}`
export const payCardLink = (code: string) => `${APP_URL}/p/${code}`

/** Abre WhatsApp con el mensaje listo; false si el navegador lo bloqueó. */
export function openWhatsApp(text: string): boolean {
  const win = window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  if (!win) return false
  win.opener = null
  return true
}

export const canNativeShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function'

/** La hoja de compartir del teléfono (WhatsApp, Telegram, SMS…). */
export async function nativeShare(text: string, url?: string): Promise<boolean> {
  if (!canNativeShare()) return false
  try {
    await navigator.share(url ? { text, url } : { text })
    return true
  } catch {
    return false
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Plan B para navegadores sin permiso de portapapeles.
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

// ─── Mensajes (amables, nunca con tono de cobro) ─────────────

export function inviteMessage(title: string, totalCents: number, currency: string, code: string): string {
  return `¡Hola! 👋 Estoy dividiendo la cuenta «${title}» (${formatMoney(totalCents, currency)}) en MitiMiti. Entra con un toque, sin descargar nada, y mira cuánto te toca: ${billLink(code)}`
}

export function billReminderMessage(name: string, amountCents: number, currency: string, title: string, code: string): string {
  return `¡Hola ${firstName(name)}! 👋 Te recuerdo los ${formatMoney(amountCents, currency)} de «${title}». Aquí ves cómo pagarme en un minuto: ${billLink(code)}`
}

export function guestShareMessage(name: string, amountCents: number, currency: string, title: string, token: string): string {
  return `¡Hola ${firstName(name)}! 👋 De «${title}» te tocan ${formatMoney(amountCents, currency)}. Aquí ves el detalle y cómo pagarme: ${debtLink(token)}`
}

export function personReminderMessage(name: string, amountCents: number, currency: string, what: string): string {
  return `¡Hola ${firstName(name)}! 👋 Te recuerdo los ${formatMoney(amountCents, currency)} que tenemos pendientes (${what}). Cuando puedas, aquí ves cómo pagarme 🧡 ${APP_URL}/saldos`
}

export function debtLinkMessage(lent: boolean, amountCents: number, currency: string, concept: string | null, token: string): string {
  const what = concept ? ` (${concept})` : ''
  return lent
    ? `¡Hola! 👋 Te presté ${formatMoney(amountCents, currency)}${what} y lo anoté en MitiMiti para que no se nos olvide. Cuando puedas, aquí ves cómo pagarme: ${debtLink(token)}`
    : `¡Hola! 👋 Anoté en MitiMiti los ${formatMoney(amountCents, currency)}${what} que me prestaste, para no olvidarme de devolvértelos. Confírmalo aquí: ${debtLink(token)}`
}

export function payCardMessage(code: string): string {
  return `Aquí están mis datos para pagarme, listos para copiar 👉 ${payCardLink(code)}`
}

export function settledMessage(title: string, totalCents: number, currency: string, people: number): string {
  return `✅ Dividimos «${title}» (${formatMoney(totalCents, currency)}) entre ${people} con MitiMiti: sin calculadora y sin "te transfiero luego". Cuentas claras, amistades largas 🧡 ${APP_URL}`
}
