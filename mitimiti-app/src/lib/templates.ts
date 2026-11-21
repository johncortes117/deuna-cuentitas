// ─── Mensajes prearmados para WhatsApp ───────────────────────
// Todos los textos que la app manda a compartir viven aquí, con sus marcas
// {así}, para poder afinarlos sin tocar las pantallas. El tono es el de un
// amigo cómplice: directo, cálido, con humor ligero y cero lenguaje bancario.

export const TEMPLATES = {
  /** Invitar a una cuenta (QR, link o código). */
  invite: 'Entra a la sala de {hostName}. Aquí dividimos cuánto pone cada uno sin sacar calculadora: {roomUrl}',
  /**
   * Recordar lo de una cuenta grupal (desde la cuenta y desde Saldos). Al final
   * va el link: ahí el amigo ve cómo pagar y avisa para dejarlo a mano.
   */
  reminder: 'Hola {debtorName}, soy MitiMiti 👀 Te recuerdo los {amount} de {concept} que puso {creditorName}. Apenas le pagues, avísale para dejarlo a mano.\n{link}',
  /** Préstamo 1 a 1 recién anotado, cuando acolitaste tú. */
  loan: 'Te acolité con {amount} de {concept}. Lo anoté en MitiMiti para que no se nos olvide:\n{loanUrl}',
  /** Préstamo 1 a 1 recién anotado, cuando te acolitaron a ti. */
  loanBorrowed: 'Me acolitaste con {amount} de {concept}. Lo anoté en MitiMiti para no olvidarme:\n{loanUrl}',
  /** Recordar un préstamo 1 a 1. */
  loanReminder: 'Te recuerdo que te acolité con {amount} de {concept} 👀 Apenas me pagues, lo dejamos a mano aquí:\n{loanUrl}',
  /** Junto a la tarjeta de deuda perdonada, para quien debía. */
  forgiven: 'Listo {debtorName}, te perdoné lo de {concept} 💜 Divide y acolita entre panas.',
  /** Junto a la tarjeta sin monto (historias, grupos). */
  forgivenPublic: 'Esta fue por mi cuenta 💜 Divide y acolita entre panas. {appUrl}',
  /** Junto al recibo grupal de cierre. */
  groupSettled: '¡Todo cuadrado! Así quedó lo de {planName} en MitiMiti 👇',
  /** Junto al comprobante de deuda saldada, para quien pagó. */
  settled: 'Listo {debtorName}, ya quedó tachado lo de {concept} en MitiMiti ✅',
  /** El mismo comprobante, si lo manda quien pagó (desde el historial). */
  settledByDebtor: 'Listo {creditorName}, ya te pagué lo de {concept}. Quedó tachado en MitiMiti ✅',
} as const

/** Frases rápidas al perdonar (van en la tarjeta). */
export const FORGIVE_NOTES = ['Esta va por mi cuenta.', 'La próxima la pones tú.', "Pa' que no se pierda la amistad."] as const

export type TemplateName = keyof typeof TEMPLATES

/** Sin concepto, la frase queda sin el " de {concept}" ("Te acolité con $5,00."). */
export function withoutConcept(template: string): string {
  return template.replace(' de {concept}', '')
}

/** Reemplaza cada {marca} por su valor. Una marca sin valor queda vacía. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '')
}

/** El concepto entre comillas latinas («Cena»), o uno genérico si no hay. */
export function conceptText(concept: string | null | undefined, fallback = 'nuestro préstamo'): string {
  const c = concept?.trim()
  return c ? `«${c}»` : fallback
}
