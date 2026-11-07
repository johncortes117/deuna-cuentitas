// ─── Avisos ("Ana se unió", "Juan te pagó $8") ───────────────
// Arriba, breves y sin bloquear nada. Cada acción importante tiene una
// respuesta visible: cerrar el ciclo es lo que genera confianza.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from './cx'

export interface ToastInput {
  title: string
  body?: string
  emoji?: string
  tone?: 'good' | 'info' | 'warn' | 'error'
  action?: { label: string; onClick: () => void }
  duration?: number
}

interface ToastItem extends ToastInput {
  id: number
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {})

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), [])

  const show = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++
      // Como mucho dos a la vez: el más viejo se va cuando llega uno nuevo.
      setItems((all) => [...all.slice(-1), { ...t, id }])
      window.setTimeout(() => dismiss(id), t.duration ?? (t.action ? 6500 : 4200))
    },
    [dismiss],
  )

  const value = useMemo(() => show, [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4 pt-safe" role="status" aria-live="polite">
          {items.map((t) => (
            <div
              key={t.id}
              className={cx(
                'pointer-events-auto flex w-full max-w-[448px] animate-toast items-center gap-3 rounded-2xl border bg-surface px-4 py-3 shadow-float',
                t.tone === 'error' ? 'border-danger/25' : t.tone === 'good' ? 'border-positive/20' : 'border-line',
              )}
            >
              {t.emoji && (
                <span
                  className={cx(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[20px]',
                    t.tone === 'good' ? 'bg-positive-soft' : t.tone === 'warn' ? 'bg-warning-soft' : t.tone === 'error' ? 'bg-danger-soft' : 'bg-surface-2',
                  )}
                  aria-hidden="true"
                >
                  {t.emoji}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className={cx('text-[15px] font-semibold leading-snug', t.tone === 'error' ? 'text-danger' : 'text-ink')}>{t.title}</p>
                {t.body && <p className="mt-0.5 text-[13px] leading-snug text-muted">{t.body}</p>}
              </div>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick()
                    dismiss(t.id)
                  }}
                  className="shrink-0 rounded-full bg-ink px-3.5 py-2 text-[13px] font-semibold text-on-ink active:scale-95"
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
