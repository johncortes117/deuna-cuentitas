// ─── Recibos en pantalla ─────────────────────────────────────
// La tarjeta que aparece después de perdonar (o de confirmar un pago) vive
// aquí, encima de todo: si esa acción cierra la cuenta y la pantalla cambia a
// "¡Todo cuadrado!", el recibo sigue abierto.
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ForgivenReceiptSheet, GroupReceiptSheet, SettledReceiptSheet } from '../features/shared/Receipt'
import type { ForgivenData, GroupData, SettledData } from '../features/shared/Receipt'

type Receipt = { kind: 'forgiven'; data: ForgivenData } | { kind: 'settled'; data: SettledData } | { kind: 'group'; data: GroupData }

const ReceiptsContext = createContext<(r: Receipt) => void>(() => {})

// eslint-disable-next-line react-refresh/only-export-components
export const useShowReceipt = () => useContext(ReceiptsContext)

export function ReceiptsProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Receipt | null>(null)
  const show = useCallback((r: Receipt) => setCurrent(r), [])
  const close = useCallback(() => setCurrent(null), [])
  const value = useMemo(() => show, [show])
  return (
    <ReceiptsContext.Provider value={value}>
      {children}
      {current?.kind === 'forgiven' && <ForgivenReceiptSheet key={JSON.stringify(current.data)} data={current.data} onClose={close} />}
      {current?.kind === 'group' && <GroupReceiptSheet key={JSON.stringify(current.data)} data={current.data} onClose={close} />}
      {current?.kind === 'settled' && <SettledReceiptSheet key={JSON.stringify(current.data)} data={current.data} onClose={close} />}
    </ReceiptsContext.Provider>
  )
}
