// ─── Nueva cuenta ────────────────────────────────────────────
// Una pantalla y lo normal es: escribir el total y tocar "Crear cuenta". El
// nombre ya viene sugerido según la hora (Almuerzo, Cena…). Cómo dividirla se
// decide después, con todos en la mesa.
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Pencil } from 'lucide-react'
import { api } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { inputToCents, keypadInput } from '../../lib/money'
import { suggestTitle } from '../../lib/dates'
import { TopBar } from '../../ui/Layout'
import { AmountInput, Keypad } from '../../ui/Keypad'
import { Button } from '../../ui/Button'
import { Chip, TextField } from '../../ui/Controls'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'
import { BILL_TITLES } from '../shared/titles'

export default function NewBillPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [amount, setAmount] = useState('0')
  const [title, setTitle] = useState(suggestTitle)
  const [customOpen, setCustomOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const cents = inputToCents(amount)
  const isSuggested = BILL_TITLES.some((t) => t.label === title)
  // La sugerencia de la hora va primero; el resto en su orden.
  const chips = [...BILL_TITLES.filter((t) => t.label === suggestTitle()), ...BILL_TITLES.filter((t) => t.label !== suggestTitle())]

  const create = async () => {
    if (cents <= 0 || busy) return
    setBusy(true)
    try {
      const bill = await api.createBill(title, cents)
      navigate(`/c/${bill.code}`, { replace: true })
    } catch (err) {
      toast({ title: errorMessage(err), tone: 'error', emoji: '⚠️' })
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar back title="Nueva cuenta" />
      <div className="flex flex-1 flex-col px-5 pb-safe">
        <div className="pt-4 text-center tiny:pt-1">
          <p className="text-[16px] font-semibold text-ink-2">¿Cuánto es la cuenta?</p>
          <AmountInput value={amount} className="mt-2" />
          <p className="mx-auto mt-3 max-w-[300px] text-[14px] leading-snug text-muted short:hidden">El total que dice la cuenta, con IVA y servicio. Después se divide con todos en la mesa.</p>
          <p className="mt-2 hidden text-[13.5px] text-muted short:block">El total, con IVA y servicio incluidos.</p>
        </div>

        <div className="mt-6 short:mt-4">
          <p className="mb-2 px-1 text-[14px] font-semibold text-ink-2">¿Qué están pagando?</p>
          <div className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {!isSuggested && (
              <Chip selected onClick={() => { setDraft(title); setCustomOpen(true) }} icon="✏️">
                {title}
              </Chip>
            )}
            {chips.map((t) => (
              <Chip key={t.label} selected={title === t.label} onClick={() => setTitle(t.label)} icon={t.emoji}>
                {t.label}
              </Chip>
            ))}
            <Chip onClick={() => { setDraft(isSuggested ? '' : title); setCustomOpen(true) }} icon={<Pencil size={15} />}>
              Otro nombre
            </Chip>
          </div>
        </div>

        <Keypad className="mt-auto pt-4 tiny:pt-2" onKey={(k) => setAmount((v) => keypadInput(v, k))} />

        <Button className="mt-3" full disabled={cents <= 0} loading={busy} onClick={create}>
          Crear cuenta
        </Button>
      </div>

      <Sheet
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title="¿Qué están pagando?"
        description="Así todos la reconocen en su historial."
        footer={
          <Button
            full
            disabled={!draft.trim()}
            onClick={() => {
              setTitle(draft.trim())
              setCustomOpen(false)
            }}
          >
            Usar este nombre
          </Button>
        }
      >
        <TextField
          label="Nombre de la cuenta"
          hideLabel
          placeholder="Ej. Cumpleaños de Ana"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={40}
          autoFocus
          data-autofocus
          enterKeyHint="done"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              setTitle(draft.trim())
              setCustomOpen(false)
            }
          }}
          className="pt-2"
        />
      </Sheet>
    </div>
  )
}
