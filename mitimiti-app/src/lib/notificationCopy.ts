// Qué dice cada notificación (en el aviso y en Actividad) y a dónde lleva.
import { formatMoney } from './money'
import { PAID_VIA, capitalize } from './payMethods'
import type { AppNotification, PayMethodType } from './types'

export interface NotificationCopy {
  title: string
  body: string
  tone: 'good' | 'info' | 'warn'
  emoji: string
  href: string
}

export function notificationCopy(n: AppNotification): NotificationCopy {
  const who = n.actor_name ?? 'Alguien'
  const amount = n.amount_cents != null ? formatMoney(n.amount_cents, n.currency ?? 'USD') : ''
  const title = n.title ? `«${n.title}»` : ''
  const code = typeof n.data.code === 'string' ? n.data.code : null
  const via = typeof n.data.method === 'string' && n.data.method in PAID_VIA ? PAID_VIA[n.data.method as PayMethodType] : null
  const billHref = code ? `/c/${code}` : '/saldos'

  switch (n.kind) {
    case 'bill_split': {
      const creditor = typeof n.data.creditor_name === 'string' ? n.data.creditor_name : who
      return { emoji: '🧾', tone: 'info', title: `Te tocan ${amount} de ${title}`, body: `${who} dividió la cuenta. Le pagas a ${creditor}.`, href: billHref }
    }
    case 'bill_reopened':
      return { emoji: '✏️', tone: 'info', title: `${who} está corrigiendo ${title}`, body: 'La división se reabrió: espera los montos nuevos.', href: billHref }
    case 'bill_cancelled':
      return { emoji: '🗑️', tone: 'info', title: `${who} canceló ${title}`, body: 'No queda nada por pagar en esa cuenta.', href: '/' }
    case 'bill_settled':
      return { emoji: '🎉', tone: 'good', title: `¡Todos te pagaron ${title}!`, body: 'Cuentas claras, amistades largas.', href: billHref }
    case 'payment_reported':
      return { emoji: '💸', tone: 'warn', title: `${who} dice que te pagó ${amount}`, body: `${via ? `${capitalize(via)}. ` : ''}Confírmalo cuando lo veas.`, href: billHref }
    case 'payment_confirmed':
      return { emoji: '✅', tone: 'good', title: `${who} confirmó tu pago de ${amount}`, body: 'Ya no le debes nada por eso.', href: billHref }
    case 'payment_rejected':
      return { emoji: '🤔', tone: 'warn', title: `A ${who} no le llegó tu pago de ${amount}`, body: 'Revisa la transferencia o háblalo con esa persona.', href: billHref }
    case 'payment_marked':
      return { emoji: '✅', tone: 'good', title: `${who} anotó que ya le pagaste ${amount}`, body: 'Quedó saldado.', href: billHref }
    case 'debt_forgiven':
      return { emoji: '🤍', tone: 'good', title: `${who} te perdonó ${amount}`, body: 'Ya no le debes eso.', href: billHref }
    case 'reminder':
      return { emoji: '👋', tone: 'info', title: `${who} te recuerda ${amount}`, body: 'Mira cómo pagarle en un minuto.', href: '/saldos' }
    case 'link_accepted':
      return n.data.creator_lent === false
        ? { emoji: '🤝', tone: 'good', title: `${who} confirmó que le debes ${amount}`, body: 'Págale cuando puedas desde Saldos.', href: '/saldos' }
        : { emoji: '🤝', tone: 'good', title: `${who} aceptó: te debe ${amount}`, body: 'Te avisaremos cuando te pague.', href: '/saldos' }
    case 'link_declined':
      return { emoji: '🤔', tone: 'warn', title: `${who} dice que no reconoce ${amount}`, body: 'Quizás ya lo arreglaron. Quedó en tu historial.', href: '/saldos' }
    case 'guest_claimed':
      return { emoji: '🙌', tone: 'good', title: `${who} se unió con su parte de ${title}`, body: `Ahora puede pagarte ${amount} desde la app.`, href: billHref }
    default:
      return { emoji: '🔔', tone: 'info', title: 'Novedades en tus cuentas', body: '', href: '/' }
  }
}
