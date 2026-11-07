// Préstamos anotados a mano y compartidos por WhatsApp: el amigo los abre sin
// tener la app, los confirma (o dice que no) y paga. Si hay deudas en los dos
// sentidos, se ve y se paga solo el neto.
import { expect, test } from '@playwright/test'
import { addDeuna, debtTokenIn, newPhone, signUp, typeAmount } from './helpers'

test('le presté $5: mi amigo lo confirma, me paga y quedamos a mano', async ({ browser }) => {
  const pedro = await newPhone(browser)
  const sofia = await newPhone(browser)
  await signUp(pedro.page, 'Pedro')
  await addDeuna(pedro.page, '0987654321')

  await pedro.page.goto('/prestamo')
  await typeAmount(pedro.page, '5')
  await pedro.page.getByRole('button', { name: /Taxi/ }).click()
  await pedro.page.getByRole('button', { name: 'Anotar y enviar por WhatsApp' }).click()
  await expect(pedro.page.getByRole('heading', { name: '¡Quedó anotado!' })).toBeVisible()
  await expect.poll(() => pedro.whatsapp.length).toBe(1)
  expect(pedro.whatsapp[0]).toContain('Te presté $5,00 (Taxi)')

  // Sofía abre el link sin la app.
  await sofia.page.goto(`/d/${debtTokenIn(pedro.whatsapp[0])}`)
  await expect(sofia.page.getByText('Pedro te prestó')).toBeVisible()
  await sofia.page.getByLabel('¿Cómo te llamas?').fill('Sofía')
  await sofia.page.getByRole('button', { name: 'Sí, se lo debo' }).click()
  await expect(sofia.page.getByText('Cómo pagarle a Pedro')).toBeVisible()
  await expect(sofia.page.getByText('098 765 4321')).toBeVisible()

  // Le paga y le avisa.
  await sofia.page.getByRole('button', { name: 'Ya le pagué' }).click()
  await sofia.page.getByRole('dialog').getByRole('button', { name: 'Deuna', exact: true }).click()
  await sofia.page.getByRole('button', { name: 'Sí, avisarle a Pedro' }).click()

  // Pedro lo confirma desde Saldos.
  await pedro.page.goto('/saldos')
  await expect(pedro.page.getByText('Por confirmar')).toBeVisible()
  await pedro.page.getByText('Sofía').first().click()
  await expect(pedro.page.getByText('Sofía dice que te pagó $5,00')).toBeVisible()
  await pedro.page.getByRole('button', { name: 'Recibido' }).click()
  await expect(pedro.page.getByText('Están a mano')).toBeVisible()
  await pedro.page.goto('/saldos')
  await expect(pedro.page.getByText('Estás al día')).toBeVisible()
})

test('deudas en los dos sentidos: se ve y se paga solo el neto', async ({ browser }) => {
  const pedro = await newPhone(browser)
  const sofia = await newPhone(browser)
  await signUp(pedro.page, 'Pedro')
  await signUp(sofia.page, 'Sofía')

  // Pedro le prestó $5 a Sofía…
  await pedro.page.goto('/prestamo')
  await typeAmount(pedro.page, '5')
  await pedro.page.getByRole('button', { name: 'Anotar y enviar por WhatsApp' }).click()
  await expect.poll(() => pedro.whatsapp.length).toBe(1)
  await sofia.page.goto(`/d/${debtTokenIn(pedro.whatsapp[0])}`)
  await sofia.page.getByRole('button', { name: 'Sí, se lo debo' }).click()
  await expect(sofia.page.getByText('Cómo pagarle a Pedro')).toBeVisible()

  // …y Sofía le había prestado $12 a Pedro (lo anota Pedro: "me prestaron").
  await pedro.page.goto('/prestamo')
  await pedro.page.getByRole('radio', { name: 'Me prestaron' }).click()
  await typeAmount(pedro.page, '12')
  await pedro.page.getByRole('button', { name: 'Anotar y enviar por WhatsApp' }).click()
  await expect.poll(() => pedro.whatsapp.length).toBe(2)
  expect(pedro.whatsapp[1]).toContain('que me prestaste')
  await sofia.page.goto(`/d/${debtTokenIn(pedro.whatsapp[1])}`)
  await expect(sofia.page.getByText('Pedro anotó que te debe')).toBeVisible()
  await sofia.page.getByRole('button', { name: 'Sí, me debe $12,00' }).click()

  // A Pedro le avisan con la frase correcta ("le debes", no "te debe").
  await pedro.page.goto('/actividad')
  await expect(pedro.page.getByText('Sofía confirmó que le debes $12,00')).toBeVisible()

  // Neto: Pedro le debe $7 a Sofía, y lo paga de una vez.
  await pedro.page.goto('/saldos')
  await pedro.page.getByText('Sofía').first().click()
  await expect(pedro.page.getByText('Le debes a Sofía')).toBeVisible()
  await expect(pedro.page.getByText('$7,00').first()).toBeVisible()
  await pedro.page.getByRole('button', { name: 'Ya le pagué $7,00' }).click()
  await pedro.page.getByRole('dialog').getByRole('button', { name: 'Efectivo', exact: true }).click()
  await pedro.page.getByRole('button', { name: 'Sí, avisarle a Sofía' }).click()

  await sofia.page.goto('/saldos')
  await sofia.page.getByText('Pedro').first().click()
  await expect(sofia.page.getByText('Pedro dice que te pagó $7,00')).toBeVisible()
  await expect(sofia.page.getByText(/En efectivo/)).toBeVisible()
  await sofia.page.getByRole('button', { name: 'Recibido' }).click()
  await expect(sofia.page.getByText('Están a mano')).toBeVisible()
})

test('quien no reconoce una deuda puede decirlo, aunque no tenga la app', async ({ browser }) => {
  const pedro = await newPhone(browser)
  const luis = await newPhone(browser)
  await signUp(pedro.page, 'Pedro')
  await pedro.page.goto('/prestamo')
  await typeAmount(pedro.page, '3')
  await pedro.page.getByRole('button', { name: 'Anotar y enviar por WhatsApp' }).click()
  await expect.poll(() => pedro.whatsapp.length).toBe(1)

  await luis.page.goto(`/d/${debtTokenIn(pedro.whatsapp[0])}`)
  await luis.page.getByRole('button', { name: 'No le debo nada a Pedro' }).click()
  const sheet = luis.page.getByRole('dialog')
  await sheet.getByLabel('¿Cómo te llamas?').fill('Luis')
  await sheet.getByRole('button', { name: 'Avisarle a Pedro' }).click()
  await expect(luis.page.getByText('Esto no quedó anotado a tu nombre.')).toBeVisible()

  await pedro.page.goto('/actividad')
  await expect(pedro.page.getByText('Luis dice que no reconoce $3,00')).toBeVisible()
})
