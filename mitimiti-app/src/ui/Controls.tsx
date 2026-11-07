// ─── Controles: chips, selector segmentado, campo de texto ───
import { forwardRef, useId, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { cx } from './cx'
import { copyText } from '../lib/share'
import { tap } from './haptics'

export function Chip({ selected, onClick, children, icon }: { selected?: boolean; onClick: () => void; children: ReactNode; icon?: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[15px] font-semibold transition active:scale-95',
        selected ? 'border-ink bg-ink text-on-ink' : 'border-line-strong bg-surface text-ink hover:bg-surface-2',
      )}
    >
      {icon && <span className="text-[17px] leading-none" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: ReactNode }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid rounded-2xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              tap(5)
              onChange(o.value)
            }}
            className={cx(
              'flex h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-[14px] font-semibold transition',
              active ? 'bg-surface text-ink shadow-[0_1px_3px_rgb(23_21_31/0.12)]' : 'text-muted hover:text-ink',
            )}
          >
            {o.icon}
            <span className="truncate">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string | null
  hideLabel?: boolean
}

export const TextField = forwardRef<HTMLInputElement, FieldProps>(function TextField({ label, hint, error, hideLabel, className, id, ...rest }, ref) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className={className}>
      <label htmlFor={inputId} className={cx('mb-1.5 block text-[14px] font-semibold text-ink-2', hideLabel && 'sr-only')}>
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${inputId}-hint` : undefined}
        className={cx(
          'h-14 w-full rounded-2xl border bg-surface px-4 text-[17px] text-ink outline-none transition placeholder:text-subtle focus:border-ink focus:ring-4 focus:ring-ink/10',
          error ? 'border-danger' : 'border-line-strong',
        )}
        {...rest}
      />
      {(hint || error) && (
        <p id={`${inputId}-hint`} className={cx('mt-1.5 text-[13px]', error ? 'text-danger' : 'text-muted')}>
          {error || hint}
        </p>
      )}
    </div>
  )
})

/** Botón de copiar con confirmación visible ("✓ Copiado"). */
export function CopyButton({ text, label = 'Copiar', copiedLabel = 'Copiado', className, onCopied }: { text: string; label?: string; copiedLabel?: string; className?: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          tap(10)
          setCopied(true)
          onCopied?.()
          window.setTimeout(() => setCopied(false), 1800)
        }
      }}
      className={cx(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold transition active:scale-95',
        copied ? 'bg-positive-soft text-positive' : 'bg-surface-2 text-ink hover:bg-surface-3',
        className,
      )}
      aria-live="polite"
    >
      {copied ? <Check size={16} strokeWidth={2.75} /> : <Copy size={16} strokeWidth={2.25} />}
      {copied ? copiedLabel : label}
    </button>
  )
}

export function StatusPill({ tone, children }: { tone: 'good' | 'warn' | 'muted' | 'info' | 'danger'; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold leading-none',
        tone === 'good' && 'bg-positive-soft text-positive',
        tone === 'warn' && 'bg-warning-soft text-warning',
        tone === 'muted' && 'bg-surface-2 text-muted',
        tone === 'info' && 'bg-brand-soft text-brand-ink',
        tone === 'danger' && 'bg-danger-soft text-danger',
      )}
    >
      {children}
    </span>
  )
}
