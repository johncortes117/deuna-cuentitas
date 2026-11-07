import { NavLink } from 'react-router'
import { Home, Scale, UserRound } from 'lucide-react'
import { cx } from './cx'
import { useNotifications } from '../state/notifications'

const TABS = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/saldos', label: 'Saldos', icon: Scale, end: false },
  { to: '/tu', label: 'Tú', icon: UserRound, end: false },
]

export function BottomNav() {
  const { toConfirm } = useNotifications()
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-line bg-surface/95 pb-safe backdrop-blur-md">
      <div className="grid grid-cols-3">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx('relative flex flex-col items-center gap-1 pb-1 pt-2.5 text-[12px] font-semibold transition', isActive ? 'text-ink' : 'text-muted hover:text-ink')
            }
          >
            {({ isActive }) => (
              <>
                <span className={cx('flex h-8 w-14 items-center justify-center rounded-full transition', isActive && 'bg-surface-2')}>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
                </span>
                {label}
                {to === '/saldos' && toConfirm > 0 && (
                  <span className="absolute right-[calc(50%-26px)] top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white ring-2 ring-surface" aria-label={`${toConfirm} pagos por confirmar`}>
                    {toConfirm}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
