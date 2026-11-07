import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { LogoMark } from '../../ui/Logo'
import { cx } from '../../ui/cx'

/** QR con el link real: se escanea con la cámara del celular, sin la app. */
export function QrCode({ url, size = 220, framed = true }: { url: string; size?: number; framed?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!canvas.current) return
    void QRCode.toCanvas(canvas.current, url, {
      width: size,
      margin: framed ? 1 : 0,
      errorCorrectionLevel: 'H',
      color: { dark: '#17151F', light: '#FFFFFF' },
    })
  }, [url, size, framed])
  const logo = Math.round(size * 0.2)
  return (
    <span className={cx('relative inline-flex shrink-0 bg-white', framed && 'rounded-3xl p-3 shadow-card')}>
      <canvas ref={canvas} width={size} height={size} style={{ width: size, height: size }} role="img" aria-label="Código QR para entrar a la cuenta" />
      <span
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#17151F]"
        style={{ width: logo + 8, height: logo + 8 }}
        aria-hidden="true"
      >
        <LogoMark size={logo} />
      </span>
    </span>
  )
}
