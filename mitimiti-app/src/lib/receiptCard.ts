// ─── Tarjetas para compartir (recibos) ───────────────────────
// Un solo generador para todas las tarjetas que se mandan por WhatsApp o a
// historias: deuda perdonada y deuda saldada (y, más adelante, el cierre de una
// mesa). Se dibuja en un canvas de 1080 × 1350 px (4:5), en claro siempre,
// para que se vea igual de nítida en cualquier teléfono, y sale como PNG.

import { LOGO_LEFT, LOGO_RIGHT } from './logoPaths'
import { participantsLine } from './groupPrize'

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
  | {
      /** Cierre grupal: la cuenta quedó 100 % cuadrada. */
      kind: 'group'
      planName: string
      hostName: string
      participants: string[]
      /** "$48,75" */
      total: string
      date: string
      /** "12 min", "Mismo día" */
      elapsed: string
      prize?: { icon: string; label: string; value: string } | null
      hideAmount?: boolean
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
  tintForgiven: '#F5F3FF',
  tintSettled: '#EEFBF5',
}

/** El ticket: márgenes, perforaciones (y de cada línea punteada) y muescas. */
const T = { x: 90, y: 76, w: CARD_WIDTH - 180, h: CARD_HEIGHT - 152, r: 48, notch: 34, perf1: 420, perf2: 1028 }

const FONT = '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/** Dónde va el sello, en fracciones de la tarjeta (para animarlo encima). */
export const STAMP_POSITION = { x: 0.5, y: 326 / CARD_HEIGHT, rotate: -6 }

export const STAMP = {
  forgiven: { text: 'PERDONADA', color: C.lavender, bg: C.lavenderBg },
  settled: { text: 'A MANO', color: C.mintDeep, bg: C.mintIce },
  group: { text: 'CUADRADA', color: C.mintDeep, bg: C.mintIce },
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
  const word = 'Miti'
  const w = ctx.measureText(word).width
  const mark = 60
  const total = mark + 14 + w * 2
  const x = cx - total / 2
  // Los dos medios tickets del logo.
  ctx.translate(x, y - mark / 2)
  ctx.scale(mark / 48, mark / 48)
  ctx.fillStyle = C.ink
  ctx.fill(new Path2D(LOGO_LEFT))
  ctx.fillStyle = C.mint
  ctx.fill(new Path2D(LOGO_RIGHT))
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = C.ink
  ctx.fillText(word, x + mark + 14, y + 2)
  ctx.fillStyle = C.mintDeep
  ctx.fillText(word, x + mark + 14 + w, y + 2)
  ctx.restore()
}

/**
 * El ticket troquelado: blanco, con la cabecera teñida y un medio círculo
 * recortado a cada lado de las dos perforaciones. Se dibuja aparte para que
 * la sombra siga el troquel.
 */
function drawTicket(ctx: CanvasRenderingContext2D, tint: string) {
  const t = document.createElement('canvas')
  t.width = CARD_WIDTH
  t.height = CARD_HEIGHT
  const k = t.getContext('2d')!
  roundRect(k, T.x, T.y, T.w, T.h, T.r)
  k.fillStyle = C.surface
  k.fill()
  k.globalCompositeOperation = 'source-atop'
  k.fillStyle = tint
  k.fillRect(T.x, T.y, T.w, T.perf1 - T.y)
  k.globalCompositeOperation = 'destination-out'
  for (const y of [T.perf1, T.perf2]) {
    for (const x of [T.x, T.x + T.w]) {
      k.beginPath()
      k.arc(x, y, T.notch, 0, Math.PI * 2)
      k.fill()
    }
  }
  ctx.save()
  ctx.shadowColor = 'rgba(18, 21, 20, 0.12)'
  ctx.shadowBlur = 44
  ctx.shadowOffsetY = 14
  ctx.drawImage(t, 0, 0)
  ctx.restore()
  // Las perforaciones, entre muesca y muesca.
  dashed(ctx, T.perf1, T.x + T.notch + 22, T.x + T.w - T.notch - 22)
  dashed(ctx, T.perf2, T.x + T.notch + 22, T.x + T.w - T.notch - 22)
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
  drawTicket(ctx, card.kind === 'forgiven' ? C.tintForgiven : C.tintSettled)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // Cabecera
  ctx.fillStyle = card.kind === 'forgiven' ? C.lavenderText : C.mintDeep
  ctx.font = `700 26px ${FONT}`
  ctx.letterSpacing = '5px'
  ctx.fillText(card.kind === 'forgiven' ? 'RECIBO DE BUENA ONDA' : card.kind === 'group' ? 'CUENTA CERRADA' : 'COMPROBANTE DE PAGO', CARD_WIDTH / 2, 150)
  ctx.fillStyle = C.ink
  ctx.font = `800 64px ${FONT}`
  ctx.letterSpacing = '-1.5px'
  ctx.fillText(card.kind === 'forgiven' ? 'Cuenta perdonada' : card.kind === 'group' ? '¡Todo cuadrado!' : '¡Quedamos a mano!', CARD_WIDTH / 2, 222)
  if (options.stamp !== false) drawStamp(ctx, card.kind)

  if (card.kind === 'group') {
    drawGroupBody(ctx, card, measure)
    drawStub(ctx, options)
    return toPng(canvas)
  }

  const hide = card.kind === 'forgiven' && card.hideAmount
  let y = T.perf1
  if (!hide) {
    ctx.fillStyle = C.ink
    let size = 172
    ctx.font = `800 ${size}px ${FONT}`
    ctx.letterSpacing = '-6px'
    while (measure(card.amount) > T.w - 160 && size > 90) {
      size -= 8
      ctx.font = `800 ${size}px ${FONT}`
    }
    ctx.fillText(card.amount, CARD_WIDTH / 2, 640)
    ctx.letterSpacing = '0px'
    ctx.fillStyle = C.muted
    ctx.font = `600 40px ${FONT}`
    const detail =
      card.kind === 'forgiven' ? `${card.creditorName} le perdonó a ${card.debtorName} · ${card.concept}` : `${card.debtorName} le pagó a ${card.creditorName}`
    y = centered(ctx, wrapText(measure, detail, T.w - 160, 2), 724, 54)
  } else {
    ctx.fillStyle = C.ink
    ctx.font = `800 64px ${FONT}`
    ctx.letterSpacing = '-1.5px'
    y = centered(ctx, wrapText(measure, `${card.creditorName} perdonó una cuenta de ${card.concept}`, T.w - 160, 4), 590, 80)
    ctx.letterSpacing = '0px'
  }

  if (card.kind === 'forgiven' && card.note) {
    // La frase, en una cápsula lavanda.
    ctx.font = `600 42px ${FONT}`
    const lines = wrapText(measure, `«${card.note}»`, T.w - 240, 2)
    const top = Math.max(y + 90, 840)
    const boxW = Math.max(...lines.map(measure)) + 96
    const boxH = lines.length * 56 + 52
    roundRect(ctx, CARD_WIDTH / 2 - boxW / 2, top, boxW, boxH, 36)
    ctx.fillStyle = C.lavenderBg
    ctx.fill()
    ctx.fillStyle = C.lavenderText
    centered(ctx, lines, top + 72, 56)
  }

  if (card.kind === 'settled') {
    const rows: [string, string][] = [
      ['Concepto', card.concept],
      ['Fecha', card.date],
      ['Tiempo', `⚡ ${card.elapsed}`],
    ]
    let ry = 840
    for (const [i, [label, value]] of rows.entries()) {
      ctx.textAlign = 'left'
      ctx.fillStyle = C.subtle
      ctx.font = `500 34px ${FONT}`
      ctx.fillText(label, T.x + 80, ry)
      ctx.textAlign = 'right'
      ctx.fillStyle = C.ink
      ctx.font = `700 36px ${FONT}`
      ctx.fillText(wrapText(measure, value, 520, 1)[0], T.x + T.w - 80, ry)
      if (i < rows.length - 1) {
        ctx.fillStyle = '#EEF1EF'
        ctx.fillRect(T.x + 80, ry + 26, T.w - 160, 2)
      }
      ry += 70
    }
    ctx.textAlign = 'center'
  }

  drawStub(ctx, options)
  return toPng(canvas)
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'))
}

function drawStub(ctx: CanvasRenderingContext2D, options: RenderOptions) {
  // Talón con la marca
  drawLogo(ctx, CARD_WIDTH / 2, 1112)
  ctx.textAlign = 'center'
  ctx.fillStyle = C.ink
  ctx.font = `600 32px ${FONT}`
  ctx.fillText('Divide y acolita entre panas.', CARD_WIDTH / 2, 1186)
  ctx.fillStyle = C.subtle
  ctx.font = `500 28px ${FONT}`
  ctx.fillText(options.domain ?? 'mitimiti.app', CARD_WIDTH / 2, 1230)

}

/** El cuerpo del recibo grupal: el plan, cuántos panas, quiénes, el premio y las filas. */
function drawGroupBody(ctx: CanvasRenderingContext2D, card: Extract<ReceiptCard, { kind: 'group' }>, measure: (t: string) => number) {
  const maxW = T.w - 160
  ctx.textAlign = 'center'
  ctx.fillStyle = C.ink
  ctx.font = `800 86px ${FONT}`
  ctx.letterSpacing = '-2.5px'
  let y = centered(ctx, wrapText(measure, card.planName, maxW, 2), 528, 92)
  ctx.letterSpacing = '0px'

  ctx.font = `700 42px ${FONT}`
  ctx.fillStyle = C.ink
  const n = card.participants.length
  ctx.fillText(`${n} ${n === 1 ? 'pana' : 'panas'} · ${card.hideAmount ? 'Sin dramas' : card.total}`, CARD_WIDTH / 2, y + 74)
  ctx.font = `500 32px ${FONT}`
  ctx.fillStyle = C.muted
  ctx.fillText(wrapText(measure, participantsLine(card.participants), maxW, 1)[0], CARD_WIDTH / 2, y + 124)
  y += 124

  if (card.prize) {
    ctx.font = `700 34px ${FONT}`
    const text = `${card.prize.icon} ${card.prize.label}: ${card.prize.value}`
    const label = wrapText(measure, text, maxW - 80, 1)[0]
    const w = measure(label) + 72
    const top = y + 30
    roundRect(ctx, CARD_WIDTH / 2 - w / 2, top, w, 70, 35)
    ctx.fillStyle = C.mintIce
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(11, 143, 101, 0.35)'
    ctx.stroke()
    ctx.fillStyle = C.mintDeep
    ctx.textBaseline = 'middle'
    ctx.fillText(label, CARD_WIDTH / 2, top + 37)
    ctx.textBaseline = 'alphabetic'
    y = top + 70
  }

  const rows: [string, string][] = [
    ['Armada por', card.hostName],
    ['Tiempo', card.elapsed],
    ['Fecha', card.date],
  ]
  let ry = Math.max(y + 66, 820)
  const gap = Math.min(64, (T.perf2 - 36 - ry) / 2)
  for (const [i, [label, value]] of rows.entries()) {
    ctx.textAlign = 'left'
    ctx.fillStyle = C.subtle
    ctx.font = `500 32px ${FONT}`
    ctx.fillText(label, T.x + 80, ry)
    ctx.textAlign = 'right'
    ctx.fillStyle = C.ink
    ctx.font = `700 34px ${FONT}`
    ctx.fillText(wrapText(measure, value, 520, 1)[0], T.x + T.w - 80, ry)
    if (i < rows.length - 1) {
      ctx.fillStyle = '#EEF1EF'
      ctx.fillRect(T.x + 80, ry + gap / 2 - 6, T.w - 160, 2)
    }
    ry += gap
  }
  ctx.textAlign = 'center'
}
