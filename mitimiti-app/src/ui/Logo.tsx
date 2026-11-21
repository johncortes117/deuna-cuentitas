// Dos medios tickets, con su perforación hacia afuera: miti-miti, como un recibo partido.
import { LOGO_LEFT, LOGO_RIGHT } from '../lib/logoPaths'

export function LogoMark({ size = 32, className, animated = false }: { size?: number; className?: string; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="currentColor" d={LOGO_LEFT} className={animated ? 'logo-half-left' : undefined} />
      <path fill="var(--brand)" d={LOGO_RIGHT} className={animated ? 'logo-half-right' : undefined} />
    </svg>
  )
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink" aria-label="MitiMiti">
      <LogoMark size={size} />
      <span className="font-extrabold tracking-[-0.04em]" style={{ fontSize: size * 0.78 }} aria-hidden="true">
        Miti<span className="text-brand">Miti</span>
      </span>
    </span>
  )
}
