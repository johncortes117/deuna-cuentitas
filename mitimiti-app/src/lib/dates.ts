// Fechas en palabras ("Hoy", "Ayer", "12 de octubre"): nunca abreviaturas
// como "12 oct", que muchos leen mal.

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function daysSince(iso: string, now = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000)
}

export function relativeDay(iso: string, now = new Date()): string {
  const days = daysSince(iso, now)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  if (days < 14) return 'Hace 1 semana'
  if (days < 28) return `Hace ${Math.floor(days / 7)} semanas`
  const d = new Date(iso)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric'
  return d.toLocaleDateString('es-EC', opts)
}

/** Para la actividad: "Ahora", "Hace 5 min", "Hace 3 h", luego el día. */
export function timeAgo(iso: string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  return relativeDay(iso, now)
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** 72 s → "1 min 12 s" */
export function formatDuration(seconds: number): string {
  const s = Math.max(1, Math.round(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m === 0) return `${r} s`
  if (r === 0 || m >= 10) return `${m} min`
  return `${m} min ${r} s`
}

/** Sugerencia según la hora: casi siempre basta con no escribir nada. */
export function suggestTitle(date = new Date()): string {
  const h = date.getHours()
  if (h >= 5 && h < 11) return 'Desayuno'
  if (h >= 11 && h < 16) return 'Almuerzo'
  if (h >= 16 && h < 19) return 'Café'
  return 'Cena'
}
