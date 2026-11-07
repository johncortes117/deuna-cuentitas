// "Ya tengo cuenta": recuperarla en este celular con el correo que la respalda.
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useSession } from '../../state/session'
import { errorMessage } from '../../lib/errors'
import { track } from '../../lib/api'
import { TopBar } from '../../ui/Layout'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Controls'

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

export default function RestorePage() {
  const { requestRestoreCode, confirmRestoreCode } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/'
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar back="/bienvenida" title="Ya tengo cuenta" />
      <div className="flex flex-1 flex-col px-6 pb-safe pt-6">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-ink">
          {step === 'email' ? 'Recupera tus cuentas' : 'Escribe el código'}
        </h1>
        <p className="mt-2 text-[15px] leading-snug text-muted">
          {step === 'email'
            ? 'Con el correo con el que respaldaste tu cuenta. Te mandamos un código, sin contraseñas.'
            : `Te lo mandamos a ${email.trim()}. Revisa también Spam.`}
        </p>
        <div className="mt-8">
          {step === 'email' ? (
            <TextField label="Tu correo" type="email" inputMode="email" autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} error={error} autoFocus />
          ) : (
            <TextField
              label="Código"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              error={error}
              autoFocus
              className="[&_input]:text-center [&_input]:text-[26px] [&_input]:font-bold [&_input]:tracking-[0.4em]"
            />
          )}
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-8">
          {step === 'email' ? (
            <Button full disabled={!emailOk(email)} loading={busy} onClick={() => run(async () => { await requestRestoreCode(email); setStep('code') })}>
              Enviarme el código
            </Button>
          ) : (
            <Button
              full
              disabled={code.length < 6}
              loading={busy}
              onClick={() =>
                run(async () => {
                  await confirmRestoreCode(email, code)
                  track('account_restored', {})
                  navigate(next, { replace: true })
                })
              }
            >
              Entrar
            </Button>
          )}
          <p className="text-center text-[13.5px] text-muted">¿Nunca la respaldaste? Empieza de nuevo con tu nombre: tus amigos te pueden volver a enviar sus links.</p>
        </div>
      </div>
    </div>
  )
}
