import { avatarColor, initials } from '../lib/avatar'
import { cx } from './cx'

interface AvatarProps {
  name: string
  color?: number | null
  size?: number
  /** Alguien que estaba en la mesa sin la app: borde punteado, sin color. */
  guest?: boolean
  className?: string
  ring?: boolean
}

export function Avatar({ name, color, size = 44, guest = false, className, ring = false }: AvatarProps) {
  const fontSize = Math.max(11, Math.round(size * 0.36))
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold leading-none tracking-[-0.02em]',
        guest ? 'border-2 border-dashed border-line-strong bg-surface-2 text-muted' : 'text-white',
        ring && 'ring-[3px] ring-surface',
        className,
      )}
      style={{ width: size, height: size, fontSize, backgroundColor: guest ? undefined : avatarColor(color) }}
    >
      {initials(name)}
    </span>
  )
}

/** Varias caras superpuestas ("Ana, Luis y 3 más"). */
export function AvatarStack({ people, size = 28, max = 4 }: { people: { name: string; color?: number | null; guest?: boolean }[]; size?: number; max?: number }) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  return (
    <span className="flex items-center" aria-hidden="true">
      {shown.map((p, i) => (
        <Avatar key={`${p.name}-${i}`} name={p.name} color={p.color} guest={p.guest} size={size} ring className={i > 0 ? '-ml-2' : ''} />
      ))}
      {rest > 0 && (
        <span
          className="-ml-2 inline-flex items-center justify-center rounded-full bg-surface-3 font-bold text-ink-2 ring-[3px] ring-surface"
          style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
        >
          +{rest}
        </span>
      )}
    </span>
  )
}
