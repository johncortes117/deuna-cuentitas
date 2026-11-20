// ─── Cómo pagarle a alguien ──────────────────────────────────
// Sus datos con un botón para copiar cada uno (el número de cuenta, el
// celular de Deuna o todo junto para pegar en la app del banco).
import { Banknote, Building2, Check, Copy, MessageCircle, Smartphone, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { copyText } from '../../lib/share'
import { tap } from '../../ui/haptics'
import { cx } from '../../ui/cx'
import type { ReactNode } from 'react'
import { CopyButton } from '../../ui/Controls'
import { accountTypeLabel, isDeunaLink, methodCopyText, prettyPhone, sortMethods } from '../../lib/payMethods'
import { DeunaPayActions } from './DeunaQr'
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

/** Copiar solo un dato (p. ej. el número de cuenta), con un ícono al lado. */
function CopyIcon({ text, label, onCopied }: { text: string; label: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label={copied ? 'Copiado' : label}
      title={label}
      onClick={async () => {
        if (await copyText(text)) {
          tap(10)
          setCopied(true)
          onCopied?.()
          window.setTimeout(() => setCopied(false), 1800)
        }
      }}
      className={cx('-my-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90', copied ? 'text-positive' : 'text-muted hover:bg-surface-2 hover:text-ink')}
    >
      {copied ? <Check size={16} strokeWidth={2.75} /> : <Copy size={16} strokeWidth={2.25} />}
    </button>
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
            if (isDeunaLink(m.qr)) {
              return (
                <Row
                  key={i}
                  below
                  icon={ICONS.deuna}
                  title="Deuna"
                  detail={
                    m.phone ? (
                      <span className="flex flex-wrap items-center gap-x-2">
                        Con un toque, o al <span className="tabular">{prettyPhone(m.phone)}</span>
                        <CopyButton text={m.phone} label="Copiar número" className="h-8 px-2.5 text-[13px]" onCopied={() => onCopy?.('deuna')} />
                      </span>
                    ) : (
                      'Te lleva a la app de Deuna con todo listo.'
                    )
                  }
                >
                  <DeunaPayActions link={m.qr!} name={name} onPay={() => onCopy?.('deuna')} />
                </Row>
              )
            }
            return (
              <Row key={i} icon={ICONS.deuna} title="Deuna" detail={<span className="tabular">{prettyPhone(m.phone)}</span>}>
                <CopyButton text={m.phone} label="Copiar" onCopied={() => onCopy?.('deuna')} />
              </Row>
            )
          case 'payphone':
            return (
              <Row key={i} icon={ICONS[m.type]} title="Payphone" detail={<span className="tabular">{prettyPhone(m.phone)}</span>}>
                <CopyButton text={m.phone} label="Copiar" onCopied={() => onCopy?.('payphone')} />
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
                    <span className="flex items-center gap-1">
                      {accountTypeLabel(m.account_type)} · <span className="tabular font-semibold text-ink-2">{m.account_number}</span>
                      <CopyIcon text={m.account_number} label="Copiar número de cuenta" onCopied={() => onCopy?.('transfer')} />
                    </span>
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
