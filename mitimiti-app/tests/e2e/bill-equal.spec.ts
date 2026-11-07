// Una cena en partes iguales: Ana paga en el local, Luis entra con el link y
// Sofía con el código. Luis avisa que pagó por Deuna y Ana lo confirma; Sofía
// le paga en efectivo. Todo en vivo entre los tres teléfonos.
import { expect, test } from '@playwright/test'
import { addDeuna, createBill, joinBill, newPhone, row, signUp } from './helpers'

test('dividir en partes iguales, avisar el pago y confirmarlo', async ({ browser }) => {
  const ana = await newPhone(browser)
  const luis = await newPhone(browser)
  const sofia = await newPhone(browser)

  await signUp(ana.page, 'Ana')
  await addDeuna(ana.page, '0991234567')
  const code = await createBill(ana.page, '45,10', 'Cena')
  await expect(ana.page.getByText('Invita a la mesa')).toBeVisible()
  await expect(ana.page.getByText(/Comparte el link: hace falta al menos otra persona/)).toBeVisible()

  // Luis entra con el link y Sofía dictando el código (en minúsculas, da igual).
  await joinBill(luis.page, code, 'Luis')
  await sofia.page.goto('/unirme')
  await sofia.page.getByLabel('Código de la cuenta').fill(code.toLowerCase())
  await sofia.page.waitForURL(new RegExp(`/c/${code}$`))
  await sofia.page.getByLabel('¿Cómo te llamas?').fill('Sofía')
  await sofia.page.getByRole('button', { name: 'Entrar a la cuenta' }).click()
  await expect(sofia.page.getByText('Por ahora te toca')).toBeVisible()

  // Ana los ve llegar sin recargar. $45,10 entre 3: el centavo que sobra lo pone quien pagó.
  await expect(ana.page.getByText('En la mesa · 3')).toBeVisible()
  await ana.page.getByRole('button', { name: 'Dividir entre 3 · $15,03 c/u' }).click()
  await expect(ana.page.getByText('Te deben')).toBeVisible()
  await expect(ana.page.getByText('$30,06')).toBeVisible()

  // Luis ve cuánto le toca y los datos de Ana para pagarle.
  await expect(luis.page.getByText('Le debes a Ana')).toBeVisible()
  await expect(luis.page.getByText('$15,03').first()).toBeVisible()
  await expect(luis.page.getByText('099 123 4567')).toBeVisible()
  await luis.page.getByRole('button', { name: 'Ya le pagué' }).click()
  await luis.page.getByRole('dialog').getByRole('button', { name: 'Deuna', exact: true }).click()
  await luis.page.getByRole('button', { name: 'Sí, avisarle a Ana' }).click()
  await expect(luis.page.getByText('Le avisaste que pagaste por Deuna. Falta que Ana lo confirme.')).toBeVisible()

  // A Ana le llega el aviso y confirma.
  const luisRow = row(ana.page, 'Luis')
  await expect(luisRow.getByText('Dice que te pagó')).toBeVisible()
  await luisRow.getByRole('button', { name: 'Recibido' }).click()
  await expect(luisRow.getByText('Pagó ✓')).toBeVisible()
  await expect(luis.page.getByText(/Ana confirmó tu pago/).first()).toBeVisible()

  // Sofía le pagó en efectivo: Ana lo anota y la cuenta se cierra sola.
  await row(ana.page, 'Sofía').getByRole('button', { name: 'Ya me pagó' }).click()
  await ana.page.getByRole('button', { name: 'Sí, ya me pagó' }).click()
  await expect(ana.page.getByRole('heading', { name: '¡Cuentas claras!' })).toBeVisible()
  await expect(sofia.page.getByRole('heading', { name: '¡Cuentas claras!' })).toBeVisible()
  await expect(luis.page.getByRole('heading', { name: '¡Cuentas claras!' })).toBeVisible()

  // En el inicio de Ana ya no queda nada pendiente.
  await ana.page.goto('/')
  await expect(ana.page.getByText('Estás al día')).toBeVisible()
})

test('quien no está en la mesa no puede entrar a una cuenta ya dividida', async ({ browser }) => {
  const ana = await newPhone(browser)
  const luis = await newPhone(browser)
  const late = await newPhone(browser)
  await signUp(ana.page, 'Ana')
  const code = await createBill(ana.page, '20')
  await joinBill(luis.page, code, 'Luis')
  await ana.page.getByRole('button', { name: 'Dividir entre 2 · $10,00 c/u' }).click()
  await expect(ana.page.getByText('Quién te debe')).toBeVisible()

  await late.page.goto(`/c/${code}`)
  await expect(late.page.getByText('Esta cuenta ya se dividió')).toBeVisible()
  await expect(late.page.getByLabel('¿Cómo te llamas?')).toHaveCount(0)
})
