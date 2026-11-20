// El QR de cobro de Deuna de alguien, redibujado a partir de su link (nítido
// siempre, sin guardar imágenes). Desde el mismo celular se paga con el botón
// "Pagar con Deuna" (abre el link); el QR sirve para que lo escanee otro
// teléfono en la mesa o para guardarlo y cargarlo desde la galería.
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download, ExternalLink, QrCode as QrIcon } from 'lucide-react'
import { isDeunaLink } from '../../lib/payMethods'
import { firstName } from '../../lib/avatar'
import { Sheet } from '../../ui/Sheet'
import { cx } from '../../ui/cx'

/** La imagen del QR (PNG en memoria). */
export function DeunaQrImage({ link, size = 240, alt }: { link: string; size?: number; alt: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(link, { width: 720, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#17151F', light: '#FFFFFF' } })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null))
    return () => {
      alive = false
    }
  }, [link])
  return (
    <span className="inline-flex shrink-0 rounded-2xl border border-line bg-white p-1.5" style={{ width: size + 14, height: size + 14 }}>
      {src ? <img src={src} alt={alt} width={size} height={size} className="block" /> : <span className="block animate-pulse rounded-xl bg-surface-2" style={{ width: size, height: size }} />}
    </span>
  )
}

/** Los dos botones de Deuna para quien paga. */
export function DeunaPayActions({ link, name, onPay }: { link: string; name: string; onPay?: () => void }) {
  const [open, setOpen] = useState(false)
  const [png, setPng] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    let alive = true
    QRCode.toDataURL(link, { width: 1024, margin: 4, errorCorrectionLevel: 'M' })
      .then((url) => alive && setPng(url))
      .catch(() => alive && setPng(null))
    return () => {
      alive = false
    }
  }, [open, link])
  if (!isDeunaLink(link)) return null
  const who = firstName(name)
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <a
          href={link.trim()}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onPay?.()}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-semibold text-on-ink transition active:scale-95"
        >
          <ExternalLink size={16} aria-hidden="true" /> Pagar con Deuna
        </a>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[14px] font-semibold text-ink transition hover:bg-surface-3 active:scale-95">
          <QrIcon size={16} aria-hidden="true" /> Ver QR
        </button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={`QR de Deuna de ${who}`} description="Escanéalo con la app de Deuna desde otro celular, o guarda la imagen y cárgala desde la galería.">
        <div className="flex flex-col items-center gap-4 pb-4 pt-2">
          <DeunaQrImage link={link} size={250} alt={`Código QR de Deuna de ${who}`} />
          <div className="flex w-full flex-col gap-2">
            <a href={link.trim()} target="_blank" rel="noopener noreferrer" onClick={() => onPay?.()} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink text-[16px] font-semibold text-on-ink active:scale-[0.98]">
              <ExternalLink size={18} aria-hidden="true" /> Abrir en Deuna
            </a>
            <a
              href={png ?? undefined}
              download={`qr-deuna-${who.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-') || 'cobro'}.png`}
              aria-disabled={!png}
              className={cx('inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-line-strong text-[16px] font-semibold text-ink active:scale-[0.98]', !png && 'pointer-events-none opacity-50')}
            >
              <Download size={18} aria-hidden="true" /> Guardar imagen
            </a>
          </div>
        </div>
      </Sheet>
    </>
  )
}
