// Un almuerzo por productos, con la abuela que no tiene celular. Lo que la
// cuenta tiene de más sobre los productos (IVA, servicio) se reparte en
// proporción. La parte de la abuela sale con un link, y cuando su nieta lo
// abre, la deuda (y el lugar en la mesa) pasan a ser suyos.
import { expect, test } from '@playwright/test'
import { createBill, debtTokenIn, joinBill, newPhone, row, signUp } from './helpers'

test('dividir por productos, con alguien sin celular que después reclama su parte', async ({ browser }) => {
  const ana = await newPhone(browser)
  const luis = await newPhone(browser)
  const carla = await newPhone(browser)

  await signUp(ana.page, 'Ana')
  const code = await createBill(ana.page, '40', 'Almuerzo')
  await joinBill(luis.page, code, 'Luis')

  // La abuela, sin celular.
  await ana.page.getByRole('button', { name: 'Agregar a alguien sin celular' }).click()
  await ana.page.getByRole('dialog').getByRole('textbox').fill('Abuela')
  await ana.page.getByRole('button', { name: 'Agregar a la cuenta' }).click()
  await expect(ana.page.getByText('En la mesa · 3')).toBeVisible()

  // Por productos: Ana anota la cuenta de corrido.
  await ana.page.getByRole('radio', { name: /Productos/ }).click()
  await ana.page.getByRole('button', { name: 'Agregar producto' }).first().click()
  const items = [['Ceviche', '12,00'], ['Encebollado', '10,00'], ['Jugo', '4,00'], ['Patacones', '6,00']]
  for (const [i, [name, price]] of items.entries()) {
    // De corrido, sin esperar a que se guarde el anterior.
    await ana.page.getByRole('textbox', { name: 'Producto' }).fill(name)
    await ana.page.getByRole('textbox', { name: 'Precio' }).fill(price)
    await ana.page.getByRole('textbox', { name: 'Precio' }).press('Enter')
    await expect(ana.page.getByText(`Llevas ${i + 1} agregado${i === 0 ? '' : 's'}`)).toBeVisible()
  }
  await ana.page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()
  await expect(ana.page.getByText('Falta marcar quién pidió 4 productos ($32,00).')).toBeVisible()

  // Cada uno marca lo suyo desde su celular; los patacones, entre Ana y Luis.
  await luis.page.getByRole('checkbox', { name: 'Lo pedí: Ceviche' }).click()
  await luis.page.getByRole('checkbox', { name: 'Lo pedí: Patacones' }).click()
  await ana.page.getByRole('checkbox', { name: 'Lo pedí: Encebollado' }).click()
  await ana.page.getByRole('checkbox', { name: 'Lo pedí: Patacones' }).click()
  // El jugo era de la abuela: lo asigna Ana.
  await ana.page.getByText('Jugo', { exact: true }).click()
  const forAbuela = ana.page.getByRole('dialog').getByRole('checkbox').filter({ hasText: 'Abuela' })
  await forAbuela.click()
  await expect(forAbuela).toHaveAttribute('aria-checked', 'true')
  await ana.page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()
  await expect(ana.page.getByRole('dialog')).toHaveCount(0)

  // $32 en productos y $8 de más (25 %): cada uno pone su 25 %.
  await expect(luis.page.getByText('$15,00 de lo que marcaste + $3,75 de IVA y servicio.')).toBeVisible()
  // (la última fila con "Abuela" es la de la mesa; la otra es el jugo)
  await expect(row(ana.page, 'Abuela').last()).toContainText('$5,00')
  await ana.page.getByRole('button', { name: 'Dividir por productos' }).click()

  await expect(luis.page.getByText('Le debes a Ana')).toBeVisible()
  await expect(luis.page.getByText('$18,75').first()).toBeVisible()
  await expect(row(ana.page, 'Luis')).toContainText('$18,75')

  // Ana le manda a la familia de la abuela su parte.
  const abuela = row(ana.page, 'Abuela')
  await expect(abuela).toContainText('$5,00')
  await abuela.getByRole('button', { name: 'Enviar link' }).click()
  await expect.poll(() => ana.whatsapp.length).toBe(1)
  expect(ana.whatsapp[0]).toContain('$5,00')
  const token = debtTokenIn(ana.whatsapp[0])

  // Carla (la nieta) abre el link sin tener la app y se queda con la parte.
  await carla.page.goto(`/d/${token}`)
  await expect(carla.page.getByText('De «Almuerzo» te tocan')).toBeVisible()
  await carla.page.getByLabel('¿Cómo te llamas?').fill('Carla')
  await carla.page.getByRole('button', { name: 'Sí, es mío' }).click()
  await carla.page.waitForURL(new RegExp(`/c/${code}$`))
  await expect(carla.page.getByText('Le debes a Ana')).toBeVisible()
  await expect(carla.page.getByText('$5,00').first()).toBeVisible()

  // Y a Ana le avisan.
  await ana.page.goto('/actividad')
  await expect(ana.page.getByText('Carla se unió con su parte de «Almuerzo»')).toBeVisible()
})
