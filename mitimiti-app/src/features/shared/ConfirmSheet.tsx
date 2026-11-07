import { useState } from 'react'
import type { ReactNode } from 'react'
import { Sheet } from '../../ui/Sheet'
import { Button } from '../../ui/Button'

/** Para lo que no se puede deshacer o mueve plata: siempre se confirma. */
export function ConfirmSheet({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  body?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => Promise<void> | void
  children?: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={!busy}
      hideClose
      title={title}
      description={body}
      footer={
        <div className="flex flex-col gap-2">
          <Button full variant={danger ? 'danger' : 'primary'} loading={busy} onClick={run}>
            {confirmLabel}
          </Button>
          <Button full variant="ghost" size="md" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
        </div>
      }
    >
      {children}
    </Sheet>
  )
}
