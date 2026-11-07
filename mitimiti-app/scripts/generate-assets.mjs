// Genera los íconos de la PWA y la imagen para compartir (og.png) a partir del
// logo. Uso: node scripts/generate-assets.mjs  (requiere Playwright/Chromium).
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const font = readFileSync(join(root, 'node_modules/@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2')).toString('base64')

const INK = '#17151F'
const PAPER = '#FBF8F3'
const CORAL = '#FF5A3C'

const mark = (left, right, size) => `
  <svg width="${size}" height="${size}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="${left}" d="M22 8a16 16 0 0 0 0 32z"/>
    <path fill="${right}" d="M26 8a16 16 0 0 1 0 32z"/>
  </svg>`

const base = `
  <style>
    @font-face { font-family: Inter; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
    * { margin: 0; box-sizing: border-box; }
    body { font-family: Inter, sans-serif; -webkit-font-smoothing: antialiased; }
  </style>`

const icon = (size, { radius, scale }) => `${base}
  <div style="width:${size}px;height:${size}px;background:${INK};border-radius:${radius}px;display:flex;align-items:center;justify-content:center">
    ${mark(PAPER, CORAL, Math.round(size * scale))}
  </div>`

const og = `${base}
  <div style="width:1200px;height:630px;background:${PAPER};display:flex;align-items:center;padding:0 84px;gap:64px;position:relative;overflow:hidden">
    <div style="position:absolute;right:-120px;top:-160px;width:520px;height:520px;border-radius:50%;background:#FFEDE7"></div>
    <div style="flex:1;position:relative">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:40px">
        ${mark(INK, CORAL, 64)}
        <span style="font-size:40px;font-weight:800;letter-spacing:-1.2px;color:${INK}">Miti<span style="color:${CORAL}">Miti</span></span>
      </div>
      <h1 style="font-size:68px;line-height:1.02;font-weight:850;letter-spacing:-2.6px;color:${INK}">Divide la cuenta<br/>en la mesa.</h1>
      <p style="margin-top:24px;font-size:28px;line-height:1.35;color:#5E5867;max-width:600px">Tus amigos entran con un link, ven cuánto les toca y te pagan. Sin calculadora y sin descargar nada.</p>
      <p style="margin-top:34px;display:inline-block;font-size:22px;font-weight:700;color:${INK};background:#fff;border:2px solid #E7E1D7;border-radius:999px;padding:10px 22px">Cuentas claras, amistades largas</p>
    </div>
    <div style="width:360px;position:relative;transform:rotate(3deg)">
      <div style="background:#fff;border-radius:28px 28px 0 0;padding:30px 30px 18px;box-shadow:0 24px 60px rgba(23,21,31,.14)">
        <p style="font-size:20px;font-weight:600;color:#6B6574">🍔 Almuerzo</p>
        <p style="font-size:54px;font-weight:850;letter-spacing:-2px;color:${INK};margin-top:4px">$36,00</p>
        <div style="margin-top:22px;display:flex;flex-direction:column;gap:16px">
          ${[['Ana', '#0E7A45', 'Pagó ✓'], ['Luis', '#9A5200', 'Pendiente'], ['Tú', INK, 'Pagaste la cuenta']].map(([n, c, s]) => `
            <div style="display:flex;align-items:center;gap:14px">
              <div style="width:44px;height:44px;border-radius:50%;background:${n === 'Tú' ? INK : n === 'Ana' ? '#7C5CFC' : '#E6762F'};color:#fff;font-weight:800;font-size:17px;display:flex;align-items:center;justify-content:center">${n.slice(0, 2).toUpperCase()}</div>
              <div style="flex:1"><p style="font-size:21px;font-weight:700;color:${INK}">${n}</p><p style="font-size:16px;font-weight:600;color:${c}">${s}</p></div>
              <p style="font-size:22px;font-weight:800;color:${INK}">$12,00</p>
            </div>`).join('')}
        </div>
      </div>
      <svg width="360" height="18" viewBox="0 0 360 18" preserveAspectRatio="none" style="display:block"><path fill="#fff" d="M0 0h360v6l-15 12-15-12-15 12-15-12-15 12-15-12-15 12-15-12-15 12-15-12-15 12-15-12-15 12-15-12-15 12-15-12-15 12-15-12-15 12-15-12-15 12-15-12-15 12-15-12-15 12-15-12-15 12L0 6z"/></svg>
    </div>
  </div>`

const browser = await chromium.launch()
const page = await browser.newPage()
async function render(html, width, height, file) {
  await page.setViewportSize({ width, height })
  await page.setContent(html)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: join(root, 'public', file), omitBackground: true, clip: { x: 0, y: 0, width, height } })
  console.log('✓', file)
}
await render(icon(192, { radius: 0, scale: 0.62 }), 192, 192, 'icons/icon-192.png')
await render(icon(512, { radius: 0, scale: 0.62 }), 512, 512, 'icons/icon-512.png')
await render(icon(512, { radius: 0, scale: 0.5 }), 512, 512, 'icons/maskable-512.png')
await render(icon(180, { radius: 0, scale: 0.62 }), 180, 180, 'apple-touch-icon.png')
await render(og, 1200, 630, 'og.png')
await browser.close()
