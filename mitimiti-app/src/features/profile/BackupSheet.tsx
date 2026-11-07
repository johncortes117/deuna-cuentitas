// ─── Respaldar la cuenta con el correo ───────────────────────
// Tu cuenta vive en este celular. Con tu correo (un código de 6 dígitos, sin
// contraseña) la recuperas en otro si lo pierdes o lo cambias.
import { useState } from 'react'
import { useSession } from '../../state/session'
import { errorMessage } from '../../lib/errors'
import { track } from '../../lib/api'
import { Sheet } from '../../ui/Sheet'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Controls'
import { useToast } from '../../ui/Toast'
import { success } from '../../ui/haptics'

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

export function BackupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { requestBackupCode, confirmBackupCode } = useSession()
  const toast = useToast()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      await requestBackupCode(email)
      setStep('code')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    setBusy(true)
    setError(null)
    try {
      await confirmBackupCode(email, code)
      success()
      track('account_backed_up', {})
      toast({ title: 'Tu cuenta quedó respaldada', body: `Con ${email.trim()} la recuperas en cualquier celular.`, emoji: '🔒', tone: 'good' })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title={step === 'email' ? 'Respalda tu cuenta' : 'Escribe el código'}
      description={
        step === 'email'
          ? 'Si cambias o pierdes el celular, con tu correo recuperas tus cuentas y saldos. Sin contraseñas: te mandamos un código.'
          : `Te lo mandamos a ${email.trim()}. Puede tardar un minuto; revisa también Spam.`
      }
      footer={
        step === 'email' ? (
          <Button full disabled={!emailOk(email)} loading={busy} onClick={send}>
            Enviarme el código
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <Button full disabled={code.trim().length < 6} loading={busy} onClick={verify}>
              Confirmar
            </Button>
            <Button full variant="ghost" size="md" onClick={() => { setStep('email'); setCode('') }} disabled={busy}>
              Usar otro correo
            </Button>
          </div>
        )
      }
    >
      <div className="pb-2 pt-2">
        {step === 'email' ? (
          <TextField label="Tu correo" type="email" inputMode="email" autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} error={error} autoFocus data-autofocus />
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
            data-autofocus
            className="[&_input]:text-center [&_input]:text-[26px] [&_input]:font-bold [&_input]:tracking-[0.4em]"
          />
        )}
      </div>
    </Sheet>
  )
}
