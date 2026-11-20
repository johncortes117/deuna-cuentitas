// ─── Mensajes prearmados para WhatsApp ───────────────────────
// Todos los textos que la app manda a compartir viven aquí, con sus marcas
// {así}, para poder afinarlos sin tocar las pantallas. El tono es el de un
// amigo cómplice: directo, cálido, con humor ligero y cero lenguaje bancario.

export const TEMPLATES = {
  /** Invitar a una cuenta (QR, link o código). */
  invite: 'Únete a la sala de {hostName}. Aquí cuadramos cuánto pone cada uno sin sacar calculadora: {roomUrl}',
  /**
   * Recordar lo que te deben (desde la cuenta y desde Saldos). Al final va el
   * link: ahí el amigo ve cómo pagar y toca "Ya le pagué" para tacharlo.
   */
  reminder: 'Hola {debtorName}, soy MitiMiti 👀 Paso a recordarte los {amount} de {concept} que cubrió {creditorName}. Cuando le pases, avísale para tacharlo.\n{link}',
  /** Compartir un préstamo 1 a 1 recién anotado (en cualquier sentido). */
  loan: 'Anoté en MitiMiti los {amount} de {concept} para que no se nos olvide a ninguno. Échale un ojo aquí: {loanUrl}',
} as const

export type TemplateName = keyof typeof TEMPLATES

/** Reemplaza cada {marca} por su valor. Una marca sin valor queda vacía. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '')
}

/** El concepto entre comillas latinas («Cena»), o uno genérico si no hay. */
export function conceptText(concept: string | null | undefined, fallback = 'nuestro préstamo'): string {
  const c = concept?.trim()
  return c ? `«${c}»` : fallback
}
