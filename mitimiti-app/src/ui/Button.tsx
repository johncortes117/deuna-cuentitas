import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'brand'
type Size = 'lg' | 'md' | 'sm'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  full?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-on-ink shadow-[0_6px_16px_rgb(23_21_31/0.18)] hover:opacity-[0.93]',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2',
  soft: 'bg-surface-2 text-ink hover:bg-surface-3',
  ghost: 'text-ink hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger hover:opacity-90',
  brand: 'bg-brand-soft text-brand-ink hover:opacity-90',
}

const SIZES: Record<Size, string> = {
  lg: 'h-14 px-6 text-[17px] rounded-2xl gap-2.5',
  md: 'h-12 px-5 text-[15px] rounded-2xl gap-2',
  sm: 'h-9 px-3.5 text-[14px] rounded-full gap-1.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'lg', loading = false, icon, full = false, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex select-none items-center justify-center font-semibold tracking-[-0.01em] transition-[transform,opacity,background-color] duration-150 active:scale-[0.98] disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        full && 'w-full',
        (disabled || loading) && 'opacity-50',
        loading && 'opacity-80',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={size === 'sm' ? 14 : 18} /> : icon}
      {children}
    </button>
  )
})

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('inline-flex h-11 w-11 items-center justify-center rounded-full text-ink transition hover:bg-surface-2 active:scale-95', className)}
      {...rest}
    >
      {children}
    </button>
  )
}
