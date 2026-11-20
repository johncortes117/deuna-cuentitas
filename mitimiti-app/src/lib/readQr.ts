// Lee el código QR de una imagen (p. ej. la captura de "Mi código QR" de
// Deuna) aquí mismo en el teléfono: la imagen no se sube a ningún lado.
// jsQR se descarga solo cuando alguien usa esta opción.

const MAX_SIDE = 1600

export async function readQrFromImage(file: Blob): Promise<string | null> {
  const [{ default: jsQR }, bitmap] = await Promise.all([import('jsqr'), createImageBitmap(file)])
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, width, height)
    const { data } = ctx.getImageData(0, 0, width, height)
    return jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })?.data ?? null
  } finally {
    bitmap.close()
  }
}
