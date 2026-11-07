// ─── Hoja inferior ───────────────────────────────────────────
// Una sola implementación para todas: entra desde abajo, se cierra tocando
// afuera, deslizándola hacia abajo, con Escape o con la ✕, bloquea el scroll de atrás y lleva el foco
// adentro (lectores de pantalla y teclado). Mientras se procesa algo con
// dinero, `dismissible={false}` evita cerrarla por accidente.
import { useEffect, useId, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cx } from './cx'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  dismissible?: boolean
  /** Sin ✕ arriba (p. ej. confirmaciones con botón Cancelar). */
  hideClose?: boolean
  className?: string
}

let openSheets = 0

export function Sheet({ open, onClose, title, description, children, footer, dismissible = true, hideClose = false, className }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)
  useEffect(() => {
    closeRef.current = onClose
    dismissibleRef.current = dismissible
  })

  // Deslizar hacia abajo desde la parte de arriba (la barrita y el título) la cierra.
  const drag = useRef<{ id: number; startY: number; dy: number; t: number } | null>(null)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const onDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dismissibleRef.current || e.button !== 0 || (e.target as HTMLElement).closest('button, a, input, textarea, select')) return
    drag.current = { id: e.pointerId, startY: e.clientY, dy: 0, t: performance.now() }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return
    drag.current.dy = Math.max(0, e.clientY - drag.current.startY)
    setDragY(drag.current.dy)
  }
  const onDragEnd = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const speed = d.dy / Math.max(1, performance.now() - d.t)
    setDragging(false)
    setDragY(0)
    if (d.dy > 90 || (d.dy > 24 && speed > 0.6)) closeRef.current()
  }

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    openSheets++
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissibleRef.current) closeRef.current()
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panelRef.current
      target?.focus({ preventScroll: true })
    }, 30)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      openSheets--
      if (openSheets <= 0) document.body.style.overflow = ''
      previous?.focus?.({ preventScroll: true })
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 animate-fade bg-[var(--overlay)]" onClick={() => dismissible && onClose()} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[92dvh] w-full max-w-[480px] animate-sheet flex-col rounded-t-[28px] bg-surface shadow-float outline-none',
          className,
        )}
        // `translate` va aparte de la animación de entrada (que usa `transform`).
        style={{ translate: dragY ? `0 ${dragY}px` : undefined, transition: dragging ? 'none' : 'translate 0.2s ease-out' }}
      >
        <div className="touch-none select-none" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
        <div className="flex justify-center pb-1 pt-3" aria-hidden="true">
          <div className="h-1.5 w-10 rounded-full bg-surface-3" />
        </div>
        {(title || !hideClose) && (
          <div className="flex items-start gap-3 px-6 pb-2 pt-1">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={titleId} className="text-[21px] font-bold leading-tight tracking-[-0.02em] text-ink text-balance">
                  {title}
                </h2>
              )}
              {description && <p className="mt-1.5 text-[15px] leading-snug text-muted">{description}</p>}
            </div>
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={!dismissible}
                aria-label="Cerrar"
                className="-mr-2 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted transition hover:text-ink active:scale-95 disabled:opacity-40"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-2">{children}</div>
        {footer && <div className="px-6 pb-safe pt-3">{footer}</div>}
        {!footer && <div className="pb-safe" />}
      </div>
    </div>,
    document.body,
  )
}
