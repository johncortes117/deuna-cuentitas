// Recibo de deuda saldada: aparece al confirmar el pago, se manda al chat 1 a 1
// y se puede volver a abrir desde el historial.
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { GATEWAY_URL } from '../backend/local-config.mjs'
import { createBill, debtTokenIn, joinBill, newPhone, row, signUp, typeAmount } from './helpers'

async function pngSize(path: string) {
  const buf = await readFile(path)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

test('al confirmar "Recibido" sale el recibo y se envía el comprobante', async ({ browser }) => {
  const ana = await newPhone(browser)
  const luis = await newPhone(browser)
  await signUp(ana.page, 'Ana')
  const code = await createBill(ana.page, '20', 'Cena')
  await joinBill(luis.page, code, 'Luis')
  await ana.page.getByRole('button', { name: 'Dividir entre 2 · $10,00 c/u' }).click()

  await expect(luis.page.getByText('Le debes a Ana')).toBeVisible()
  await luis.page.getByRole('button', { name: 'Ya le pagué' }).click()
  await luis.page.getByRole('button', { name: 'Sí, avisarle a Ana' }).click()

  await row(ana.page, 'Luis').getByRole('button', { name: 'Recibido' }).click()
  const receipt = ana.page.getByRole('dialog', { name: '¡Quedamos a mano!' })
  await expect(receipt.getByRole('img', { name: /^Recibo: Luis le pagó \$10,00 a Ana por Cena\. Saldada (al instante|en 1 min)\.$/ })).toBeVisible()

  // Computador: se descarga el PNG y se abre el chat con el texto.
  const download = ana.page.waitForEvent('download')
  await receipt.getByRole('button', { name: 'Enviar comprobante a Luis' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('mitimiti-a-mano.png')
  expect(await pngSize(await file.path())).toEqual({ width: 1080, height: 1350 })
  await expect.poll(() => ana.whatsapp.length).toBe(1)
  expect(ana.whatsapp[0]).toBe('Listo Luis, ya quedó tachado lo de Cena en MitiMiti ✅')

  // Era la única deuda: la cuenta se cerró debajo y el recibo siguió abierto.
  await receipt.getByRole('button', { name: 'Cerrar' }).last().click()
  await expect(ana.page.getByRole('heading', { name: '¡Todo cuadrado!' })).toBeVisible()

  // Desde el historial se vuelve a abrir.
  await ana.page.goto('/saldos/historial')
  await ana.page.getByRole('button', { name: 'Luis te pagó. Ver recibo' }).click()
  await expect(ana.page.getByRole('dialog', { name: '¡Quedamos a mano!' }).getByRole('button', { name: 'Enviar comprobante a Luis' })).toBeVisible()
})

test('el recibo cuenta los días desde la deuda más antigua, y quien pagó también lo ve', async ({ browser }) => {
  const pedro = await newPhone(browser)
  const sofia = await newPhone(browser)
  await signUp(pedro.page, 'Pedro')
  await signUp(sofia.page, 'Sofía')
  for (const amount of ['5', '3']) {
    await pedro.page.goto('/prestamo')
    await typeAmount(pedro.page, amount)
    await pedro.page.getByRole('button', { name: 'Anotar y enviar por WhatsApp' }).click()
    await expect(pedro.page.getByRole('heading', { name: '¡Quedó anotado!' })).toBeVisible()
  }
  await expect.poll(() => pedro.whatsapp.length).toBe(2)
  const [taxi, cafe] = pedro.whatsapp.map(debtTokenIn)
  for (const token of [taxi, cafe]) {
    await sofia.page.goto(`/d/${token}`)
    await sofia.page.getByRole('button', { name: 'Sí, se lo debo' }).click()
    await expect(sofia.page.getByText('Cómo pagarle a Pedro')).toBeVisible()
  }

  // Se cobran los dos juntos ($8); el de $5 se anotó hace 3 días, así que cuenta desde ahí.
  await pedro.page.goto('/saldos')
  await pedro.page.getByText('Sofía').first().click()
  await fetch(`${GATEWAY_URL}/__test/sql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sql: "update mm_debts set created_at = now() - interval '3 days 2 hours' where link_token = $1", params: [taxi] }),
  })
  await pedro.page.getByRole('button', { name: 'Ya me pagó' }).click()
  await pedro.page.getByRole('button', { name: 'Sí, ya me pagó' }).click()
  const receipt = pedro.page.getByRole('dialog', { name: '¡Quedamos a mano!' })
  await expect(receipt.getByRole('img', { name: /Sofía le pagó \$8,00 a Pedro .*Saldada en 3 días\./ })).toBeVisible()
  await receipt.getByRole('button', { name: 'Cerrar' }).last().click()

  // Sofía, desde su historial, ve su comprobante para mandárselo a Pedro.
  await sofia.page.goto('/saldos/historial')
  await sofia.page.getByRole('button', { name: /^Le pagaste a Pedro\. Ver recibo$/ }).first().click()
  await expect(sofia.page.getByRole('dialog', { name: '¡Quedamos a mano!' }).getByRole('button', { name: 'Enviar comprobante a Pedro' })).toBeVisible()
})

test('una deuda perdonada se reabre desde el historial', async ({ browser }) => {
  const pedro = await newPhone(browser)
  const sofia = await newPhone(browser)
  await signUp(pedro.page, 'Pedro')
  await signUp(sofia.page, 'Sofía')
  await pedro.page.goto('/prestamo')
  await typeAmount(pedro.page, '4')
  await pedro.page.getByRole('button', { name: /Taxi/ }).click()
  await pedro.page.getByRole('button', { name: 'Anotar y enviar por WhatsApp' }).click()
  await expect.poll(() => pedro.whatsapp.length).toBe(1)
  await sofia.page.goto(`/d/${debtTokenIn(pedro.whatsapp[0])}`)
  await sofia.page.getByRole('button', { name: 'Sí, se lo debo' }).click()
  await expect(sofia.page.getByText('Cómo pagarle a Pedro')).toBeVisible()

  await pedro.page.goto('/saldos')
  await pedro.page.getByText('Sofía').first().click()
  await pedro.page.getByRole('button', { name: 'Perdonar' }).click()
  const ask = pedro.page.getByRole('dialog', { name: '¿Perdonas los $4,00 de Sofía?' })
  await ask.getByRole('button', { name: 'Esta va por mi cuenta.' }).click()
  await ask.getByRole('button', { name: 'Sí, perdonar' }).click()
  await pedro.page.getByRole('dialog', { name: '¡Cuenta perdonada!' }).getByRole('button', { name: 'Listo' }).click()

  await sofia.page.goto('/saldos/historial')
  await sofia.page.getByRole('button', { name: 'Pedro te perdonó. Ver recibo' }).click()
  const card = sofia.page.getByRole('dialog', { name: '¡Pedro te perdonó!' })
  await expect(card.getByRole('img', { name: 'Tarjeta: Pedro le perdonó $4,00 a Sofía por Taxi.' })).toBeVisible()
  await expect(card.getByRole('button', { name: /^Avisarle a/ })).toHaveCount(0)
})
