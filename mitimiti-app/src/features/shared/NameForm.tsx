// "¿Cómo te llamas?": lo único que se le pide a alguien nuevo.
import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Controls'
import { errorMessage } from '../../lib/errors'

export function NameForm({
  cta,
  hint = 'Así te verán tus amigos en las cuentas.',
  onSubmit,
  footer,
}: {
  cta: string
  hint?: string
  onSubmit: (name: string) => Promise<void>
  footer?: ReactNode
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clean = name.trim()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!clean || busy) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(clean)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextField
        label="¿Cómo te llamas?"
        placeholder="Tu nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        autoComplete="given-name"
        autoCapitalize="words"
        enterKeyHint="go"
        hint={error ? undefined : hint}
        error={error}
        autoFocus
        data-autofocus
      />
      <Button type="submit" full disabled={!clean} loading={busy}>
        {cta}
      </Button>
      {footer}
    </form>
  )
}
