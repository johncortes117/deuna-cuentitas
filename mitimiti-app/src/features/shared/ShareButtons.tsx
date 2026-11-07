// WhatsApp como acción principal (ahí está la conversación con los amigos),
// copiar el link para cualquier otro chat y la hoja del teléfono si existe.
import { useState } from 'react'
import { Link2, Share2 } from 'lucide-react'
import { Button } from '../../ui/Button'
import { canNativeShare, copyText, nativeShare, openWhatsApp } from '../../lib/share'
import { useToast } from '../../ui/Toast'
import { tap } from '../../ui/haptics'
import { cx } from '../../ui/cx'

export function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.6 2 2.17 6.43 2.17 11.87c0 1.74.46 3.44 1.32 4.94L2.1 22l5.32-1.39a9.86 9.86 0 0 0 4.62 1.18h.01c5.44 0 9.87-4.43 9.87-9.87 0-2.64-1.03-5.12-2.87-7.01Zm-7.01 15.2h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.16.83.84-3.08-.2-.32a8.17 8.17 0 0 1-1.25-4.34c0-4.52 3.68-8.2 8.21-8.2a8.15 8.15 0 0 1 5.8 2.41 8.15 8.15 0 0 1 2.4 5.8c0 4.53-3.68 8.23-8.15 8.23Zm4.5-6.15c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.71-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.66.31-.23.25-.86.84-.86 2.06 0 1.21.88 2.38 1 2.55.12.16 1.74 2.65 4.2 3.72.59.25 1.05.4 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.46-.6 1.66-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z" />
    </svg>
  )
}

export function ShareButtons({
  message,
  link,
  onShared,
  primaryLabel = 'Enviar por WhatsApp',
  compact = false,
  quiet = false,
}: {
  message: string
  link: string
  onShared?: (channel: 'whatsapp' | 'copy' | 'native') => void
  primaryLabel?: string
  compact?: boolean
  /** Cuando ya se envió: WhatsApp deja de ser el botón principal de la pantalla. */
  quiet?: boolean
}) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const native = canNativeShare()

  const whatsapp = () => {
    tap()
    if (!openWhatsApp(message)) {
      toast({ title: 'No pudimos abrir WhatsApp', body: 'Copia el link y pégalo en el chat.', tone: 'warn', emoji: '💬' })
      return
    }
    onShared?.('whatsapp')
  }
  const copy = async () => {
    if (await copyText(link)) {
      tap(10)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
      onShared?.('copy')
    }
  }
  const share = async () => {
    if (await nativeShare(message, link)) onShared?.('native')
  }

  return (
    <div className={cx('flex flex-col', compact ? 'gap-2' : 'gap-2.5')}>
      <Button size={compact || quiet ? 'md' : 'lg'} variant={quiet ? 'secondary' : 'primary'} full icon={<WhatsAppIcon />} onClick={whatsapp}>
        {primaryLabel}
      </Button>
      <div className={cx('grid gap-2.5', native ? 'grid-cols-2' : 'grid-cols-1')}>
        <Button variant="secondary" size="md" icon={<Link2 size={18} />} onClick={copy} className={copied ? '!border-positive/40 !bg-positive-soft !text-positive' : ''}>
          {copied ? '¡Copiado!' : 'Copiar link'}
        </Button>
        {native && (
          <Button variant="secondary" size="md" icon={<Share2 size={18} />} onClick={share}>
            Más opciones
          </Button>
        )}
      </div>
    </div>
  )
}
