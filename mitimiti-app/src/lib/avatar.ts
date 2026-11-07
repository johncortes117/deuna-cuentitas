// La misma persona siempre con el mismo color (lo guarda la base): la gente
// reconoce a sus amigos por el color antes que por el nombre. Todos dan más
// de 5:1 de contraste con las iniciales blancas.
// Doce tonos bien distintos entre sí, todos con texto blanco legible (AA).
export const AVATAR_COLORS = [
  '#6D4AE8', '#C2307A', '#C93A1F', '#B4530F', '#8A6A00', '#4F7A12',
  '#147A4B', '#0B7579', '#1769A8', '#2F55D4', '#52606D', '#9C3FB0',
]

/**
 * En una misma mesa (o lista) nadie repite color: si dos personas tienen el
 * mismo, la de clave menor se queda con el suyo y la otra toma el siguiente
 * libre. Se decide por la clave (id de la persona), nunca por el orden en
 * pantalla, así cada uno conserva su color en la cuenta, en Saldos y en su
 * detalle. Devuelve clave → índice de color.
 */
export function tableColors(people: { key: string; color: number }[]): Map<string, number> {
  const n = AVATAR_COLORS.length
  const used = new Set<number>()
  const out = new Map<string, number>()
  const byKey = [...people].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  for (const p of byKey) {
    if (out.has(p.key)) continue
    let c = ((Math.trunc(p.color ?? 0) % n) + n) % n
    for (let i = 0; i < n && used.has(c); i++) c = (c + 1) % n
    used.add(c)
    out.set(p.key, c)
  }
  return out
}

export function avatarColor(index: number | null | undefined): string {
  const i = Math.abs(Math.trunc(index ?? 0)) % AVATAR_COLORS.length
  return AVATAR_COLORS[i]
}

/** "María Andrade" → "MA" · "Luis" → "LU" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}
