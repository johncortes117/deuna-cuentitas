// Ayudas para las pruebas de punta a punta: cada "teléfono" es un contexto
// de navegador aparte (su propia sesión), como personas distintas en la mesa.
import { expect } from '@playwright/test'
import type { Browser, BrowserContext, Page } from '@playwright/test'
import { GATEWAY_URL } from '../backend/local-config.mjs'

export interface Phone {
  ctx: BrowserContext
  page: Page
  /** Mensajes que la app intentó mandar por WhatsApp (no salen a internet). */
  whatsapp: string[]
}

export async function newPhone(browser: Browser): Promise<Phone> {
  const ctx = await browser.newContext()
  const whatsapp: string[] = []
  await ctx.route('https://wa.me/**', (route) => {
    whatsapp.push(new URL(route.request().url()).searchParams.get('text') ?? '')
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>WhatsApp</title><p>WhatsApp</p>' })
  })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'])
  const page = await ctx.newPage()
  return { ctx, page, whatsapp }
}

/** Alguien nuevo abre la app y pone su nombre. */
export async function signUp(page: Page, name: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Empezar' }).click()
  await page.getByLabel('¿Cómo te llamas?').fill(name)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByText(`Hola, ${name.split(' ')[0]}`)).toBeVisible()
}

/** Escribe un monto con el teclado (la app acepta el teclado físico). */
export async function typeAmount(page: Page, amount: string) {
  await page.getByRole('group', { name: 'Teclado numérico' }).waitFor()
  await page.keyboard.type(amount)
}

export async function addDeuna(page: Page, phone: string) {
  await page.goto('/tu/cobros')
  await page.getByRole('button', { name: /^Deuna/ }).click()
  await page.getByLabel('Número de celular').fill(phone)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Tus datos')).toBeVisible()
}

/** Crea una cuenta y devuelve su código. */
export async function createBill(page: Page, amount: string, title?: string): Promise<string> {
  await page.goto('/nueva')
  await typeAmount(page, amount)
  if (title) await page.getByRole('button', { name: new RegExp(title) }).first().click()
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.waitForURL(/\/c\/[A-Z0-9]{6}$/)
  return new URL(page.url()).pathname.split('/').pop()!
}

/** Alguien sin cuenta entra por el link de la cuenta. */
export async function joinBill(page: Page, code: string, name: string) {
  await page.goto(`/c/${code}`)
  await page.getByLabel('¿Cómo te llamas?').fill(name)
  await page.getByRole('button', { name: 'Entrar a la cuenta' }).click()
  await expect(page.getByText(/Esperando a que .* divida la cuenta/)).toBeVisible()
}

/** El código de 6 dígitos que "llegó al correo" (el backend local lo guarda). */
export async function otpFor(email: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${GATEWAY_URL}/__test/otp?email=${encodeURIComponent(email)}`)
    const body = (await res.json()) as { token: string } | null
    if (body?.token) return body.token
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(`No llegó el código para ${email}`)
}

/** El token de un link /d/… dentro de un mensaje de WhatsApp. */
export function debtTokenIn(message: string | undefined): string {
  const match = message?.match(/\/d\/([A-Za-z0-9_-]+)/)
  if (!match) throw new Error(`No hay link de deuda en: ${message}`)
  return match[1]
}

/** Una fila de una lista (persona, producto) por el texto que contiene. */
export const row = (page: Page, text: string) => page.getByRole('listitem').filter({ hasText: text })

export const uniqueEmail = (name: string) => `${name.toLowerCase()}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`
