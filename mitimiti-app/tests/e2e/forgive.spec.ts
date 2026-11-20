// Perdonar una deuda: la hoja con frase rápida, la tarjeta con el sello y el
// compartido (en computador, la imagen se descarga).
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { createBill, debtTokenIn, joinBill, newPhone, row, signUp, typeAmount } from './helpers'

/** Ancho y alto de un PNG (cabecera IHDR). */
async function pngSize(path: string) {
  const buf = await readFile(path)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

test('perdonar desde la cuenta, con frase, y compartir la tarjeta sin monto', async ({ browser }) => {
  const ana = await newPhone(browser)
  const luis = await newPhone(browser)
  await signUp(ana.page, 'Ana')
  const code = await createBill(ana.page, '20', 'Cena')
  await joinBill(luis.page, code, 'Luis')
  await ana.page.getByRole('button', { name: 'Dividir entre 2 · $10,00 c/u' }).click()

  await row(ana.page, 'Luis').getByRole('button', { name: 'Perdonar' }).click()
  const sheet = ana.page.getByRole('dialog', { name: '¿Perdonas los $10,00 de Luis?' })
  await expect(sheet.getByText('La deuda se marcará como perdonada y ya no aparecerá pendiente.')).toBeVisible()
  await sheet.getByRole('button', { name: 'La próxima la pones tú.' }).click()
  await sheet.getByRole('button', { name: 'Sí, perdonar' }).click()

  // La tarjeta: con monto, y al ocultarlo cambia la vista previa.
  const receipt = ana.page.getByRole('dialog', { name: '¡Cuenta perdonada!' })
  await expect(receipt.getByRole('img', { name: 'Tarjeta: Ana le perdonó $10,00 a Luis por Cena.' })).toBeVisible()
  await receipt.getByRole('switch', { name: 'Ocultar monto' }).click()
  await expect(receipt.getByRole('img', { name: 'Tarjeta: Ana perdonó una cuenta de Cena.' })).toBeVisible()

  // Sin Web Share con archivos (computador): se descarga el PNG de 1080 × 1350.
  const download = ana.page.waitForEvent('download')
  await receipt.getByRole('button', { name: 'Compartir sin monto' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('mitimiti-perdonada.png')
  expect(await pngSize(await file.path())).toEqual({ width: 1080, height: 1350 })
  await expect(ana.page.getByText('Imagen guardada. Ya puedes enviarla por WhatsApp.')).toBeVisible()

  // Era la única deuda: la cuenta se cerró debajo, y el recibo siguió abierto.
  await receipt.getByRole('button', { name: 'Listo' }).click()
  await expect(ana.page.getByRole('heading', { name: '¡Cuentas claras!' })).toBeVisible()

  // A Luis le llega el aviso con la frase.
  await luis.page.goto('/actividad')
  await expect(luis.page.getByText('Ana te perdonó $10,00')).toBeVisible()
  await expect(luis.page.getByText('«La próxima la pones tú.»')).toBeVisible()

  // En el historial de Ana queda con el badge Perdonada.
  await ana.page.goto('/saldos/historial')
  await expect(row(ana.page, 'Perdonaste a Luis').getByText('Perdonada')).toBeVisible()
})

test('perdonar un préstamo desde Saldos', async ({ browser }) => {
  const pedro = await newPhone(browser)
  const sofia = await newPhone(browser)
  await signUp(pedro.page, 'Pedro')
  await signUp(sofia.page, 'Sofía')
  await pedro.page.goto('/prestamo')
  await typeAmount(pedro.page, '5')
  await pedro.page.getByRole('button', { name: /Taxi/ }).click()
  await pedro.page.getByRole('button', { name: 'Anotar y enviar por WhatsApp' }).click()
  await expect.poll(() => pedro.whatsapp.length).toBe(1)
  await sofia.page.goto(`/d/${debtTokenIn(pedro.whatsapp[0])}`)
  await sofia.page.getByRole('button', { name: 'Sí, se lo debo' }).click()
  await expect(sofia.page.getByText('Cómo pagarle a Pedro')).toBeVisible()

  await pedro.page.goto('/saldos')
  await pedro.page.getByText('Sofía').first().click()
  await pedro.page.getByRole('button', { name: 'Perdonar' }).click()
  await pedro.page.getByRole('dialog', { name: '¿Perdonas los $5,00 de Sofía?' }).getByRole('button', { name: 'Sí, perdonar' }).click()

  const receipt = pedro.page.getByRole('dialog', { name: '¡Cuenta perdonada!' })
  await expect(receipt.getByRole('img', { name: 'Tarjeta: Pedro le perdonó $5,00 a Sofía por Taxi.' })).toBeVisible()
  await receipt.getByRole('button', { name: 'Listo' }).click()
  await expect(pedro.page).toHaveURL(/\/saldos$/)
  await expect(pedro.page.getByText('Estás al día')).toBeVisible()
})
