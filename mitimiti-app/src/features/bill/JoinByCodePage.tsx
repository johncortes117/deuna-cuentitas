// Para cuando alguien en la mesa dicta el código ("entra con K7Q2PX").
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { TopBar } from '../../ui/Layout'
import { Button } from '../../ui/Button'

const clean = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)

export default function JoinByCodePage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = async (value: string) => {
    if (value.length !== 6 || busy) return
    setBusy(true)
    setError(null)
    try {
      const preview = await api.billPreview(value)
      if (!preview) {
        setError('No hay ninguna cuenta con ese código. Revísalo con quien te lo dio.')
        setBusy(false)
        return
      }
      navigate(`/c/${value}`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void lookup(code)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar back title="Unirme con código" />
      <form onSubmit={submit} className="flex flex-1 flex-col px-6 pb-safe pt-8">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-ink">Escribe el código de la cuenta</h1>
        <p className="mt-2 text-[15px] leading-snug text-muted">Son 6 letras y números. Lo ve quien creó la cuenta, debajo del QR.</p>
        <label htmlFor="code" className="sr-only">Código de la cuenta</label>
        <input
          id="code"
          value={code}
          onChange={(e) => {
            const next = clean(e.target.value)
            setError(null)
            setCode(next)
            // Con el sexto carácter se busca solo: un toque menos.
            if (next.length === 6 && code.length < 6) void lookup(next)
          }}
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          maxLength={8}
          placeholder="K7Q2PX"
          aria-invalid={error ? true : undefined}
          className="mt-8 h-20 w-full rounded-3xl border border-line-strong bg-surface text-center text-[36px] font-extrabold uppercase tracking-[0.35em] text-ink outline-none placeholder:text-surface-3 focus:border-ink focus:ring-4 focus:ring-ink/10"
        />
        {error && <p className="mt-3 text-center text-[14px] text-danger">{error}</p>}
        <Button type="submit" className="mt-auto" full disabled={code.length !== 6} loading={busy}>
          Buscar la cuenta
        </Button>
      </form>
    </div>
  )
}
