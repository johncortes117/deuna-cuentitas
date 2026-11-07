import { useMemo } from 'react'
import type { CSSProperties } from 'react'

const COLORS = ['#FF5A3C', '#17151F', '#FFB020', '#16A34A', '#6D4AE8', '#2F55D4']

/** Celebración breve al cerrar una cuenta (se apaga con "reducir movimiento"). */
export function Confetti({ count = 36 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: (i * 97) % 100,
        dx: `${((i * 53) % 60) - 30}px`,
        delay: ((i * 37) % 100) / 100,
        duration: 2.4 + ((i * 29) % 100) / 60,
        color: COLORS[i % COLORS.length],
        rotate: (i * 47) % 360,
      })),
    [count],
  )
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              transform: `rotate(${p.rotate}deg)`,
              '--dx': p.dx,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
