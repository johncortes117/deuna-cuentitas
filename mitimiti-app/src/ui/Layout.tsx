// ─── Estructura de pantalla ──────────────────────────────────
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { cx } from './cx'
import { IconButton } from './Button'

/** Barra de arriba: volver, título y acciones. */
export function TopBar({
  title,
  back,
  right,
  transparent = false,
}: {
  title?: ReactNode
  /** true = historial; string = ruta fija (para links que se abren directo). */
  back?: boolean | string
  right?: ReactNode
  transparent?: boolean
}) {
  const navigate = useNavigate()
  const goBack = () => {
    if (typeof back === 'string') navigate(back)
    else if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/')
  }
  return (
    <header className={cx('sticky top-0 z-30 pt-safe', !transparent && 'bg-bg/90 backdrop-blur-md')}>
      <div className="flex h-14 items-center gap-1 px-2">
        <div className="flex w-12 justify-start">
          {back && (
            <IconButton label="Volver" onClick={goBack}>
              <ChevronLeft size={26} strokeWidth={2.4} />
            </IconButton>
          )}
        </div>
        <div className="min-w-0 flex-1 text-center">
          {title && <h1 className="truncate text-[17px] font-bold tracking-[-0.01em] text-ink">{title}</h1>}
        </div>
        <div className="flex min-w-12 items-center justify-end">{right}</div>
      </div>
    </header>
  )
}

/** Contenido con márgenes y espacio para la barra o el botón de abajo. */
export function Page({ children, className, withNav = false }: { children: ReactNode; className?: string; withNav?: boolean }) {
  return <main className={cx('flex-1 px-5', withNav ? 'pb-28' : 'pb-8', className)}>{children}</main>
}

/** Botón (o botones) fijos abajo: fondo sólido y un degradé corto encima. */
export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'sticky bottom-0 z-20 -mx-5 mt-auto bg-bg px-5 pb-safe pt-3',
        "before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-gradient-to-t before:from-bg before:to-transparent before:content-['']",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Card({ children, className, as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  return <Tag className={cx('rounded-3xl border border-line bg-surface shadow-card', className)}>{children}</Tag>
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-7 flex items-baseline justify-between gap-3 px-1">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">{children}</h2>
      {right}
    </div>
  )
}

export function EmptyState({ emoji, title, body, children }: { emoji: string; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-[30px]" aria-hidden="true">
        {emoji}
      </span>
      <p className="text-[17px] font-bold text-ink">{title}</p>
      {body && <p className="mt-1.5 max-w-[300px] text-[15px] leading-snug text-muted">{body}</p>}
      {children && <div className="mt-5 w-full max-w-[320px]">{children}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-2xl bg-surface-2', className)} aria-hidden="true" />
}

/** Pantalla de "no se pudo" con salida. */
export function ErrorScreen({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-[30px]" aria-hidden="true">
        🧾
      </span>
      <h1 className="text-[21px] font-bold leading-tight text-ink text-balance">{title}</h1>
      {body && <p className="mt-2 text-[15px] leading-snug text-muted text-balance">{body}</p>}
      {action && <div className="mt-6 w-full max-w-[300px]">{action}</div>}
    </div>
  )
}
