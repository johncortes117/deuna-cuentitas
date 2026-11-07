// ─── Cómo pagarle a alguien ──────────────────────────────────
// Sus datos con un botón para copiar cada uno (el número de cuenta, el
// celular de Deuna o todo junto para pegar en la app del banco).
import { Banknote, Building2, MessageCircle, Smartphone, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { CopyButton } from '../../ui/Controls'
import { accountTypeLabel, methodCopyText, prettyPhone, sortMethods } from '../../lib/payMethods'
import type { PayMethod } from '../../lib/types'
import { firstName } from '../../lib/avatar'

const ICONS: Record<PayMethod['type'], ReactNode> = {
  deuna: <Smartphone size={20} />,
  payphone: <Smartphone size={20} />,
  transfer: <Building2 size={20} />,
  cash: <Banknote size={20} />,
  other: <Sparkles size={20} />,
}

function Row({ icon, title, detail, children, below = false }: { icon: ReactNode; title: string; detail?: ReactNode; children?: ReactNode; below?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        {detail && <div className="mt-0.5 text-[14px] leading-snug text-muted">{detail}</div>}
        {below && children && <div className="mt-2.5">{children}</div>}
      </div>
      {!below && children}
    </div>
  )
}

export function PayOptions({ name, methods, onCopy }: { name: string; methods: PayMethod[]; onCopy?: (type: PayMethod['type']) => void }) {
  if (methods.length === 0) {
    return (
      <Row
        icon={<MessageCircle size={20} />}
        title={`${firstName(name)} todavía no agregó cómo le pagan`}
        detail={<>Pregúntale por WhatsApp o págale en efectivo; después avísale aquí con <b className="text-ink-2">“Ya le pagué”</b>.</>}
      />
    )
  }
  return (
    <div className="divide-y divide-line">
      {sortMethods(methods).map((m, i) => {
        switch (m.type) {
          case 'deuna':
          case 'payphone':
            return (
              <Row key={i} icon={ICONS[m.type]} title={m.type === 'deuna' ? 'Deuna' : 'Payphone'} detail={<span className="tabular">{prettyPhone(m.phone)}</span>}>
                <CopyButton text={m.phone} label="Copiar" onCopied={() => onCopy?.(m.type)} />
              </Row>
            )
          case 'transfer':
            return (
              <Row
                key={i}
                below
                icon={ICONS.transfer}
                title={m.bank}
                detail={
                  <>
                    <span className="block">{accountTypeLabel(m.account_type)} · <span className="tabular font-semibold text-ink-2">{m.account_number}</span></span>
                    <span className="block">{m.holder}{m.id_number ? ` · C.I. ${m.id_number}` : ''}</span>
                  </>
                }
              >
                <CopyButton text={methodCopyText(m)} label="Copiar datos" onCopied={() => onCopy?.('transfer')} />
              </Row>
            )
          case 'cash':
            return <Row key={i} icon={ICONS.cash} title="Efectivo" detail="También acepta que le pagues en persona." />
          case 'other':
            return (
              <Row key={i} icon={ICONS.other} title={m.label} detail={m.value}>
                <CopyButton text={m.value} label="Copiar" onCopied={() => onCopy?.('other')} />
              </Row>
            )
        }
      })}
    </div>
  )
}
