// ─── Teclado numérico propio ─────────────────────────────────
// En vez del teclado del sistema (que tapa la pantalla y obliga a borrar lo
// que ya estaba escrito): teclas grandes, siempre en el mismo lugar.
import { useEffect, useRef } from 'react'
import { Delete } from 'lucide-react'
import { tap } from './haptics'
import { cx } from './cx'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del']

/** Tecla física → tecla del teclado en pantalla (en computador también se escribe). */
function keyFor(e: KeyboardEvent): string | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  if (/^[0-9]$/.test(e.key)) return e.key
  if (e.key === ',' || e.key === '.' || e.key === 'Decimal') return ','
  if (e.key === 'Backspace' || e.key === 'Delete') return 'del'
  return null
}

export function Keypad({ onKey, compact = false, className }: { onKey: (key: string) => void; compact?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const onKeyRef = useRef(onKey)
  useEffect(() => {
    onKeyRef.current = onKey
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = keyFor(e)
      const el = ref.current
      if (!key || !el || e.defaultPrevented) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      // Solo responde el teclado de la capa de arriba (la hoja abierta, si hay).
      const dialogs = document.querySelectorAll('[role="dialog"]')
      const top = dialogs[dialogs.length - 1]
      if (top ? !top.contains(el) : el.closest('[role="dialog"]')) return
      e.preventDefault()
      onKeyRef.current(key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div ref={ref} className={cx('grid select-none grid-cols-3 gap-1', className)} role="group" aria-label="Teclado numérico">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-label={key === 'del' ? 'Borrar' : key === ',' ? 'Coma decimal' : key}
          onClick={() => {
            tap(6)
            onKey(key)
          }}
          className={cx(
            'flex items-center justify-center rounded-2xl text-[28px] font-semibold text-ink tabular transition-colors active:bg-surface-3',
            compact ? 'h-[52px] tiny:h-[44px]' : 'h-[60px] short:h-[52px] tiny:h-[44px]',
          )}
        >
          {key === 'del' ? <Delete size={26} strokeWidth={2} aria-hidden="true" /> : key}
        </button>
      ))}
    </div>
  )
}

/** El monto grande mientras se escribe ("$ 12,5|"). */
export function AmountInput({ value, placeholder, caret = true, className, size = 'xl' }: { value: string; placeholder?: string; caret?: boolean; className?: string; size?: 'xl' | 'lg' }) {
  const empty = value === '0' && placeholder
  return (
    <p
      className={cx('font-extrabold leading-none tracking-[-0.045em] text-ink tabular', size === 'xl' ? 'text-[56px] tiny:text-[44px]' : 'text-[40px]', className)}
      aria-live="polite"
    >
      <span className="mr-1 align-top text-[0.55em] font-bold text-muted">$</span>
      <span className={empty ? 'text-subtle' : undefined}>{empty ? placeholder : value}</span>
      {caret && <span className="caret" aria-hidden="true" />}
    </p>
  )
}
