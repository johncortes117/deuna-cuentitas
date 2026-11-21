// ─── Compartir: WhatsApp primero ─────────────────────────────
// WhatsApp es donde ya está la conversación con los amigos. Cada mensaje lleva
// un link de vuelta a MitiMiti: cada cuenta, recordatorio o préstamo también
// es una invitación para quien todavía no la usa.
import { APP_URL } from './env'
import { formatMoney } from './money'
import { firstName } from './avatar'
import { TEMPLATES, conceptText, fillTemplate, withoutConcept } from './templates'

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

export function inviteMessage(hostName: string, code: string): string {
  return fillTemplate(TEMPLATES.invite, { hostName: firstName(hostName), roomUrl: billLink(code) })
}

/** Recordatorio de una cuenta: el link lleva a la cuenta, donde ve cómo pagar. */
export function billReminderMessage(debtorName: string, amountCents: number, currency: string, title: string, code: string, creditorName: string): string {
  return fillTemplate(TEMPLATES.reminder, {
    debtorName: firstName(debtorName),
    amount: formatMoney(amountCents, currency),
    concept: conceptText(title, 'la cuenta'),
    creditorName: firstName(creditorName),
    link: billLink(code),
  })
}

export function guestShareMessage(name: string, amountCents: number, currency: string, title: string, token: string): string {
  return `¡Hola ${firstName(name)}! 👋 De «${title}» te tocan ${formatMoney(amountCents, currency)}. Aquí ves el detalle y cómo pagarme: ${debtLink(token)}`
}

/** Recordatorio desde Saldos (lo que te debe una persona, en neto). */
export function personReminderMessage(debtorName: string, amountCents: number, currency: string, what: string, creditorName: string): string {
  return fillTemplate(TEMPLATES.reminder, {
    debtorName: firstName(debtorName),
    amount: formatMoney(amountCents, currency),
    concept: conceptText(what, 'lo que tenemos pendiente'),
    creditorName: firstName(creditorName),
    link: `${APP_URL}/saldos`,
  })
}

/** Préstamo 1 a 1 recién anotado (sirve en los dos sentidos). */
/** Préstamo 1 a 1 recién anotado: "Te acolité con…" o "Me acolitaste con…". */
export function debtLinkMessage(lent: boolean, amountCents: number, currency: string, concept: string | null, token: string): string {
  const base = lent ? TEMPLATES.loan : TEMPLATES.loanBorrowed
  const c = concept?.trim()
  return fillTemplate(c ? base : withoutConcept(base), {
    amount: formatMoney(amountCents, currency),
    concept: c ? `«${c}»` : '',
    loanUrl: debtLink(token),
  })
}

/** Recordar un préstamo 1 a 1 (con su link). */
export function loanReminderMessage(amountCents: number, currency: string, concept: string | null, token: string): string {
  const c = concept?.trim()
  return fillTemplate(c ? TEMPLATES.loanReminder : withoutConcept(TEMPLATES.loanReminder), {
    amount: formatMoney(amountCents, currency),
    concept: c ? `«${c}»` : '',
    loanUrl: debtLink(token),
  })
}

export function payCardMessage(code: string): string {
  return `Aquí están mis datos para pagarme, listos para copiar 👉 ${payCardLink(code)}`
}

// ─── Compartir imágenes (tarjetas) ───────────────────────────

/** El dominio que va en el pie de las tarjetas ("mitimiti.app"). */
export const appDomain = () => {
  try {
    return new URL(APP_URL).host
  } catch {
    return 'mitimiti.app'
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export type ShareImageResult = 'shared' | 'downloaded' | 'cancelled'

/**
 * La hoja de compartir del teléfono con la imagen (WhatsApp, historias…). Si el
 * navegador no puede compartir archivos (computador), la descarga.
 */
export async function shareImage(blob: Blob, filename: string, data: { title: string; text?: string }): Promise<ShareImageResult> {
  const file = new File([blob], filename, { type: 'image/png' })
  if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: data.title, text: data.text })
      return 'shared'
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return 'cancelled'
    }
  }
  downloadBlob(blob, filename)
  return 'downloaded'
}
