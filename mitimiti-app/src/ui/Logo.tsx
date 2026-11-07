// Dos mitades iguales de un círculo: miti-miti.
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="currentColor" d="M22 8a16 16 0 0 0 0 32z" />
      <path fill="var(--brand)" d="M26 8a16 16 0 0 1 0 32z" />
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
