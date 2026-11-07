// ─── Bienvenida ──────────────────────────────────────────────
// Una pantalla que explica en 5 segundos por qué vale la pena, y un solo
// dato para empezar: tu nombre. Sin contraseña, sin correo, sin tarjetas.
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { Calculator, Link2, BellRing } from 'lucide-react'
import { useSession } from '../../state/session'
import { track } from '../../lib/api'
import { Button } from '../../ui/Button'
import { Logo } from '../../ui/Logo'
import { Avatar } from '../../ui/Avatar'
import { Splash } from '../../AppFrame'
import { NameForm } from '../shared/NameForm'

function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

function HeroReceipt() {
  const rows = [
    { name: 'Ana', color: 0, status: 'Pagó ✓', tone: 'text-positive' },
    { name: 'Luis', color: 3, status: 'Pendiente', tone: 'text-warning' },
    { name: 'Tú', color: 9, status: 'Pagaste la cuenta', tone: 'text-muted' },
  ]
  return (
    <div className="relative mx-auto w-full max-w-[300px] rotate-[-2deg]" aria-hidden="true">
      <div className="absolute -right-6 -top-8 h-40 w-40 rounded-full bg-brand-soft" />
      <div className="receipt-edge relative rounded-t-[26px] bg-surface px-5 pb-4 pt-5 shadow-float">
        <p className="text-[14px] font-semibold text-muted">🍔 Almuerzo</p>
        <p className="mt-0.5 text-[38px] font-extrabold leading-none tracking-[-0.045em] text-ink tabular">$36,00</p>
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center gap-3">
              <Avatar name={r.name} color={r.color} size={34} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-tight text-ink">{r.name}</p>
                <p className={`text-[12.5px] font-semibold ${r.tone}`}>{r.status}</p>
              </div>
              <p className="text-[15px] font-bold text-ink tabular">$12,00</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const BENEFITS = [
  { icon: Link2, title: 'Sin descargar nada', body: 'Tus amigos entran desde WhatsApp o escaneando un QR.' },
  { icon: Calculator, title: 'Sin calculadora', body: 'Partes iguales, montos distintos o lo que pidió cada uno, con IVA y servicio.' },
  { icon: BellRing, title: 'Sin perseguir a nadie', body: 'Ves quién ya te pagó y recuerdas al resto con un toque.' },
]

export default function WelcomePage() {
  const { ready, profile, start } = useSession()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'))
  const [step, setStep] = useState<'intro' | 'name'>('intro')

  useEffect(() => {
    track('welcome_viewed', { next })
  }, [next])

  if (!ready) return <Splash />
  if (profile) return <Navigate to={next} replace />

  if (step === 'name') {
    return (
      <div className="flex flex-1 flex-col px-6 pb-safe pt-safe">
        <div className="pt-6">
          <Logo size={26} />
        </div>
        <div className="mt-16">
          <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.035em] text-ink text-balance">Empecemos por tu nombre</h1>
          <p className="mt-2 text-[16px] leading-snug text-muted">Es lo único que necesitas. Sin contraseñas ni correo.</p>
        </div>
        <div className="mt-8">
          <NameForm
            cta="Continuar"
            onSubmit={async (name) => {
              await start(name)
              track('onboarding_done', { next })
              navigate(next, { replace: true })
            }}
          />
        </div>
        <button type="button" onClick={() => setStep('intro')} className="mx-auto mt-6 py-2 text-[14px] font-semibold text-muted">
          Volver
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-safe pt-safe">
      <div className="flex items-center justify-between pt-5">
        <Logo size={26} />
        <Link to={`/entrar?next=${encodeURIComponent(next)}`} className="rounded-full px-3 py-2 text-[14px] font-semibold text-ink-2 hover:bg-surface-2">
          Ya tengo cuenta
        </Link>
      </div>

      <div className="mt-10 animate-rise">
        <HeroReceipt />
      </div>

      <div className="mt-12">
        <h1 className="text-[34px] font-extrabold leading-[1.02] tracking-[-0.04em] text-ink text-balance">Divide la cuenta en la mesa.</h1>
        <p className="mt-3 text-[17px] leading-snug text-muted text-balance">Tus amigos entran con un link, ven cuánto les toca y te pagan como prefieran.</p>
      </div>

      <ul className="mt-8 space-y-4">
        {BENEFITS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-ink" aria-hidden="true">
              <Icon size={21} />
            </span>
            <div>
              <p className="text-[16px] font-bold text-ink">{title}</p>
              <p className="text-[14.5px] leading-snug text-muted">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-10">
        <Button full onClick={() => setStep('name')}>
          Empezar
        </Button>
        <p className="mt-3 text-center text-[13px] text-muted">Cuentas claras, amistades largas.</p>
      </div>
    </div>
  )
}
