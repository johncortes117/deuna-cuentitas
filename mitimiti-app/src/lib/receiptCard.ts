// ─── Tarjetas para compartir (recibos) ───────────────────────
// Un solo generador para todas las tarjetas que se mandan por WhatsApp o a
// historias: deuda perdonada y deuda saldada (y, más adelante, el cierre de una
// mesa). Se dibuja en un canvas de 1080 × 1350 px (4:5), en claro siempre,
// para que se vea igual de nítida en cualquier teléfono, y sale como PNG.

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350

export type ReceiptCard =
  | {
      kind: 'forgiven'
      creditorName: string
      debtorName: string
      concept: string
      /** "$5,00" (ya formateado). */
      amount: string
      note?: string | null
      hideAmount?: boolean
    }
  | {
      kind: 'settled'
      creditorName: string
      debtorName: string
      concept: string
      amount: string
      /** "19 nov 2026" */
      date: string
      /** "Saldada en 14 min" */
      elapsed: string
    }

export interface RenderOptions {
  /** Sin el sello: la vista previa lo anima encima (ver STAMP_POSITION). */
  stamp?: boolean
  /** Dominio que va en el pie, p. ej. "mitimiti.app". */
  domain?: string
}

const C = {
  bg: '#F9F9F7',
  surface: '#FFFFFF',
  ink: '#121514',
  muted: '#646E6A',
  subtle: '#67706C',
  line: '#D9DEDB',
  mint: '#22D39A',
  mintDeep: '#0B8F65',
  mintIce: '#E8FBF4',
  lavender: '#7C6FF7',
  lavenderText: '#5F50D6',
  lavenderBg: '#F2F0FF',
}

const FONT = '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/** Dónde va el sello, en fracciones de la tarjeta (para animarlo encima). */
export const STAMP_POSITION = { x: 0.5, y: 292 / CARD_HEIGHT, rotate: -6 }

export const STAMP = {
  forgiven: { text: 'PERDONADA', color: C.lavender, bg: C.lavenderBg },
  settled: { text: 'SALDADA', color: C.mintDeep, bg: C.mintIce },
} as const

async function fontsReady() {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.all([
      document.fonts.load(`800 64px ${FONT}`),
      document.fonts.load(`600 40px ${FONT}`),
      document.fonts.load(`500 30px ${FONT}`),
    ])
  } catch {
    // Si la fuente no carga, se usa la del sistema.
  }
}

/** Parte el texto en líneas que caben en `maxWidth` (y corta con "…" si sobra). */
export function wrapText(measure: (t: string) => number, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (measure(next) <= maxWidth || !line) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]
  while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1)
  kept[maxLines - 1] = `${last.trimEnd()}…`
  return kept
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function dashed(ctx: CanvasRenderingContext2D, y: number, x1: number, x2: number) {
  ctx.save()
  ctx.strokeStyle = C.line
  ctx.lineWidth = 3
  ctx.setLineDash([14, 12])
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.stroke()
  ctx.restore()
}

function drawStamp(ctx: CanvasRenderingContext2D, kind: ReceiptCard['kind']) {
  const s = STAMP[kind]
  ctx.save()
  ctx.translate(CARD_WIDTH * STAMP_POSITION.x, CARD_HEIGHT * STAMP_POSITION.y)
  ctx.rotate((STAMP_POSITION.rotate * Math.PI) / 180)
  ctx.font = `800 44px ${FONT}`
  ctx.letterSpacing = '6px'
  const w = ctx.measureText(s.text).width + 80
  const h = 92
  roundRect(ctx, -w / 2, -h / 2, w, h, 22)
  ctx.fillStyle = s.bg
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = s.color
  ctx.stroke()
  ctx.fillStyle = s.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(s.text, 3, 2)
  ctx.restore()
}

function drawLogo(ctx: CanvasRenderingContext2D, cx: number, y: number) {
  ctx.save()
  ctx.font = `800 46px ${FONT}`
  ctx.letterSpacing = '-1.5px'
  const word1 = 'Miti'
  const w1 = ctx.measureText(word1).width
  const total = 52 + 16 + w1 * 2
  const x = cx - total / 2
  // Círculo partido: tinta y menta.
  const r = 24
  const mx = x + r + 2
  ctx.fillStyle = C.ink
  ctx.beginPath()
  ctx.arc(mx - 2, y, r, Math.PI / 2, (Math.PI * 3) / 2)
  ctx.fill()
  ctx.fillStyle = C.mint
  ctx.beginPath()
  ctx.arc(mx + 2, y, r, -Math.PI / 2, Math.PI / 2)
  ctx.fill()
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = C.ink
  ctx.fillText(word1, x + 68, y + 2)
  ctx.fillStyle = C.mintDeep
  ctx.fillText(word1, x + 68 + w1, y + 2)
  ctx.restore()
}

function centered(ctx: CanvasRenderingContext2D, lines: string[], y: number, lineHeight: number) {
  lines.forEach((l, i) => ctx.fillText(l, CARD_WIDTH / 2, y + i * lineHeight))
  return y + (lines.length - 1) * lineHeight
}

/** Dibuja la tarjeta y la devuelve como PNG. */
export async function renderReceiptCard(card: ReceiptCard, options: RenderOptions = {}): Promise<Blob> {
  await fontsReady()
  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')
  const measure = (t: string) => ctx.measureText(t).width

  // Fondo y ticket
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  ctx.save()
  ctx.shadowColor = 'rgba(18, 21, 20, 0.10)'
  ctx.shadowBlur = 48
  ctx.shadowOffsetY = 16
  roundRect(ctx, 72, 84, CARD_WIDTH - 144, CARD_HEIGHT - 168, 56)
  ctx.fillStyle = C.surface
  ctx.fill()
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // Encabezado
  ctx.fillStyle = C.ink
  ctx.font = `800 62px ${FONT}`
  ctx.letterSpacing = '-1.5px'
  ctx.fillText(card.kind === 'forgiven' ? 'Cuenta perdonada' : '¡Deuda saldada!', CARD_WIDTH / 2, 178)
  if (options.stamp !== false) drawStamp(ctx, card.kind)
  dashed(ctx, 392, 144, CARD_WIDTH - 144)

  const hide = card.kind === 'forgiven' && card.hideAmount
  let y = 372
  if (!hide) {
    ctx.fillStyle = C.ink
    ctx.font = `800 168px ${FONT}`
    ctx.letterSpacing = '-6px'
    let size = 168
    while (measure(card.amount) > CARD_WIDTH - 260 && size > 90) {
      size -= 8
      ctx.font = `800 ${size}px ${FONT}`
    }
    ctx.fillText(card.amount, CARD_WIDTH / 2, 590)
    ctx.letterSpacing = '0px'
    ctx.fillStyle = C.muted
    ctx.font = `600 40px ${FONT}`
    const detail =
      card.kind === 'forgiven' ? `${card.creditorName} le perdonó a ${card.debtorName} · ${card.concept}` : `${card.debtorName} le pagó a ${card.creditorName}`
    y = centered(ctx, wrapText(measure, detail, CARD_WIDTH - 280, 2), 680, 54)
  } else {
    ctx.fillStyle = C.ink
    ctx.font = `800 64px ${FONT}`
    ctx.letterSpacing = '-1.5px'
    y = centered(ctx, wrapText(measure, `${card.creditorName} perdonó una cuenta de ${card.concept}`, CARD_WIDTH - 280, 4), 540, 80)
    ctx.letterSpacing = '0px'
  }

  if (card.kind === 'forgiven' && card.note) {
    ctx.fillStyle = C.lavenderText
    ctx.font = `600 44px ${FONT}`
    centered(ctx, wrapText(measure, `«${card.note}»`, CARD_WIDTH - 300, 2), Math.max(y + 120, 860), 58)
  }

  if (card.kind === 'settled') {
    const rows: [string, string][] = [
      ['Concepto', card.concept],
      ['Fecha', card.date],
      ['Tiempo', `⚡ ${card.elapsed}`],
    ]
    let ry = 820
    for (const [label, value] of rows) {
      ctx.textAlign = 'left'
      ctx.fillStyle = C.subtle
      ctx.font = `500 34px ${FONT}`
      ctx.fillText(label, 160, ry)
      ctx.textAlign = 'right'
      ctx.fillStyle = C.ink
      ctx.font = `700 36px ${FONT}`
      ctx.fillText(wrapText(measure, value, 560, 1)[0], CARD_WIDTH - 160, ry)
      ry += 76
    }
    ctx.textAlign = 'center'
  }

  // Pie de marca
  dashed(ctx, 1040, 144, CARD_WIDTH - 144)
  drawLogo(ctx, CARD_WIDTH / 2, 1110)
  ctx.textAlign = 'center'
  ctx.fillStyle = C.ink
  ctx.font = `600 32px ${FONT}`
  ctx.fillText('Divide cuentas, no amistades.', CARD_WIDTH / 2, 1184)
  ctx.fillStyle = C.subtle
  ctx.font = `500 28px ${FONT}`
  ctx.fillText(options.domain ?? 'mitimiti.app', CARD_WIDTH / 2, 1228)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'))
}
