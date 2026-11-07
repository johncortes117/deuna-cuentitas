// "Ya le pagué": se elige cómo (un toque) y se le avisa a quien cobra, que
// solo confirma "Recibido". Nadie tiene que mandar capturas.
import { useState } from 'react'
import { Sheet } from '../../ui/Sheet'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Controls'
import { formatMoney } from '../../lib/money'
import { PAID_WITH } from '../../lib/payMethods'
import { firstName } from '../../lib/avatar'
import type { PayMethod, PayMethodType } from '../../lib/types'

export function ReportPaymentSheet({
  open,
  onClose,
  to,
  amountCents,
  currency,
  methods,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  to: string
  amountCents: number
  currency: string
  methods: PayMethod[]
  onConfirm: (method: PayMethodType) => Promise<void>
}) {
  const preferred = methods.find((m) => m.type !== 'cash')?.type ?? methods[0]?.type ?? 'transfer'
  const [method, setMethod] = useState<PayMethodType>(preferred)
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm(method)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title={`¿Ya le pagaste ${formatMoney(amountCents, currency)} a ${firstName(to)}?`}
      description={`Le avisamos para que lo confirme. Si todavía no le pagas, hazlo primero con sus datos.`}
      footer={
        <div className="flex flex-col gap-2">
          <Button full loading={busy} onClick={confirm}>
            Sí, avisarle a {firstName(to)}
          </Button>
          <Button full variant="ghost" size="md" onClick={onClose} disabled={busy}>
            Todavía no
          </Button>
        </div>
      }
    >
      <p className="mb-2.5 mt-2 text-[14px] font-semibold text-ink-2">¿Cómo le pagaste?</p>
      <div className="flex flex-wrap gap-2 pb-2">
        {PAID_WITH.map((o) => (
          <Chip key={o.value} selected={method === o.value} onClick={() => setMethod(o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </Sheet>
  )
}
