// Cobrar por Deuna con el QR de "Mi código QR": quien cobra sube la captura,
// la app guarda el link de pago, y quien debe ve "Pagar con Deuna" y el QR.
import { expect, test } from '@playwright/test'
import QRCode from 'qrcode'
import { createBill, joinBill, newPhone, signUp } from './helpers'

const LINK = 'https://pagar.deuna.app/TEST/person/payment?id=e2e0123456789abcdef'

async function qrPng(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, { width: 600, margin: 4 })
}

test('subir el QR de Deuna y que quien debe pueda pagar con un toque', async ({ browser }) => {
  const ana = await newPhone(browser)
  const luis = await newPhone(browser)
  await signUp(ana.page, 'Ana')

  await ana.page.goto('/tu/cobros')
  await ana.page.getByRole('button', { name: /^Deuna/ }).click()
  const upload = ana.page.getByLabel('Subir captura del QR de Deuna')

  // Un QR que no es de Deuna se rechaza.
  await upload.setInputFiles({ name: 'otro.png', mimeType: 'image/png', buffer: await qrPng('https://example.com/pagar') })
  await expect(ana.page.getByText(/Ese QR no es de cobro de Deuna/)).toBeVisible()
  await expect(ana.page.getByRole('button', { name: 'Guardar' })).toBeDisabled()

  // El de Deuna sí; con el QR, el número es opcional.
  await upload.setInputFiles({ name: 'deuna.png', mimeType: 'image/png', buffer: await qrPng(LINK) })
  await expect(ana.page.getByText('QR listo ✓')).toBeVisible()
  await ana.page.getByRole('button', { name: 'Guardar' }).click()
  await expect(ana.page.getByText('Código QR', { exact: true })).toBeVisible()

  // Una cuenta dividida: Luis le debe a Ana.
  const code = await createBill(ana.page, '20')
  await joinBill(luis.page, code, 'Luis')
  await ana.page.getByRole('button', { name: 'Dividir entre 2 · $10,00 c/u' }).click()
  await expect(luis.page.getByText('Le debes a Ana')).toBeVisible()

  const pay = luis.page.getByRole('link', { name: 'Pagar con Deuna' })
  await expect(pay).toHaveAttribute('href', LINK)
  await expect(pay).toHaveAttribute('target', '_blank')

  await luis.page.getByRole('button', { name: 'Ver QR' }).click()
  const sheet = luis.page.getByRole('dialog', { name: 'QR de Deuna de Ana' })
  await expect(sheet.getByRole('img', { name: 'Código QR de Deuna de Ana' })).toBeVisible()
  const save = sheet.getByRole('link', { name: 'Guardar imagen' })
  await expect(save).toHaveAttribute('href', /^data:image\/png;base64,/)
  await expect(save).toHaveAttribute('download', 'qr-deuna-ana.png')
})
