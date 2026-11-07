// La cuenta vive en el celular (sin contraseña). Con el correo se respalda y
// se recupera en otro; el link de cobro muestra tus datos a quien sea.
import { expect, test } from '@playwright/test'
import { addDeuna, newPhone, otpFor, signUp, typeAmount, uniqueEmail } from './helpers'

test('respaldar con el correo y recuperar todo en otro celular', async ({ browser }) => {
  const email = uniqueEmail('pedro')
  const old = await newPhone(browser)
  await signUp(old.page, 'Pedro')
  // Algo que debería seguir ahí: un préstamo pendiente.
  await old.page.goto('/prestamo')
  await typeAmount(old.page, '8')
  await old.page.getByRole('button', { name: 'Anotar y enviar por WhatsApp' }).click()
  await expect(old.page.getByRole('heading', { name: '¡Quedó anotado!' })).toBeVisible()

  await old.page.goto('/tu')
  await old.page.getByRole('button', { name: /Respalda tu cuenta/ }).click()
  await old.page.getByLabel('Tu correo').fill(email)
  await old.page.getByRole('button', { name: 'Enviarme el código' }).click()
  await old.page.getByRole('textbox', { name: 'Código' }).fill(await otpFor(email))
  await old.page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(old.page.getByText(`Respaldada con ${email}`)).toBeVisible()

  // Celular nuevo: "Ya tengo cuenta".
  const fresh = await newPhone(browser)
  await fresh.page.goto('/')
  await fresh.page.getByRole('link', { name: 'Ya tengo cuenta' }).click()
  await fresh.page.getByLabel('Tu correo').fill(email)
  await fresh.page.getByRole('button', { name: 'Enviarme el código' }).click()
  await fresh.page.getByRole('textbox', { name: 'Código' }).fill(await otpFor(email))
  await fresh.page.getByRole('button', { name: 'Entrar' }).click()
  await expect(fresh.page.getByText('Hola, Pedro')).toBeVisible()
  await fresh.page.goto('/saldos')
  await expect(fresh.page.getByText('Link sin abrir')).toBeVisible()
})

test('un código equivocado no entra y se puede corregir', async ({ browser }) => {
  const email = uniqueEmail('ana')
  const phone = await newPhone(browser)
  await signUp(phone.page, 'Ana')
  await phone.page.goto('/tu')
  await phone.page.getByRole('button', { name: /Respalda tu cuenta/ }).click()
  await phone.page.getByLabel('Tu correo').fill(email)
  await phone.page.getByRole('button', { name: 'Enviarme el código' }).click()
  const code = await otpFor(email)
  await phone.page.getByRole('textbox', { name: 'Código' }).fill(code === '111111' ? '222222' : '111111')
  await phone.page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(phone.page.getByText('Ese código no coincide o ya venció. Revísalo o pide uno nuevo.')).toBeVisible()
  await phone.page.getByRole('textbox', { name: 'Código' }).fill(code)
  await phone.page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(phone.page.getByText(`Respaldada con ${email}`)).toBeVisible()
})

test('el link de cobro muestra tus datos, listos para copiar', async ({ browser }) => {
  const pedro = await newPhone(browser)
  const stranger = await newPhone(browser)
  await signUp(pedro.page, 'Pedro')
  await addDeuna(pedro.page, '0987654321')
  await pedro.page.goto('/tu')
  await pedro.page.getByRole('button', { name: /Tu link de cobro/ }).click()
  await pedro.page.getByRole('button', { name: 'Ver cómo lo ven los demás' }).click()
  await pedro.page.waitForURL(/\/p\/[A-Za-z0-9]+$/)
  const url = pedro.page.url()

  await stranger.page.goto(url)
  await expect(stranger.page.getByRole('heading', { name: 'Cómo pagarle a Pedro' })).toBeVisible()
  await stranger.page.getByRole('button', { name: 'Copiar' }).click()
  await expect(stranger.page.getByRole('button', { name: 'Copiado' })).toBeVisible()
  expect(await stranger.page.evaluate(() => navigator.clipboard.readText())).toBe('0987654321')
  await expect(stranger.page.getByRole('button', { name: 'Probar MitiMiti' })).toBeVisible()
})

test('modo oscuro desde Tú', async ({ browser }) => {
  const phone = await newPhone(browser)
  await signUp(phone.page, 'Luis')
  await phone.page.goto('/tu')
  await phone.page.getByRole('radio', { name: 'Oscuro' }).click()
  await expect(phone.page.locator('html')).toHaveClass(/dark/)
  await phone.page.reload()
  await expect(phone.page.locator('html')).toHaveClass(/dark/)
})

test('las hojas se cierran deslizando hacia abajo', async ({ browser }) => {
  const phone = await newPhone(browser)
  await signUp(phone.page, 'Ana')
  await phone.page.goto('/tu')
  await phone.page.getByRole('button', { name: 'Cambiar tu nombre' }).click()
  const sheet = phone.page.getByRole('dialog', { name: 'Tu nombre' })
  await expect(sheet).toBeVisible()
  const box = (await sheet.boundingBox())!
  // Desde la barrita de arriba, hacia abajo.
  await phone.page.mouse.move(box.x + box.width / 2, box.y + 12)
  await phone.page.mouse.down()
  for (let i = 1; i <= 8; i++) await phone.page.mouse.move(box.x + box.width / 2, box.y + 12 + i * 20)
  await phone.page.mouse.up()
  await expect(sheet).toHaveCount(0)
})
