import { defineConfig, devices } from '@playwright/test'
import { ANON_KEY, GATEWAY_URL } from './tests/backend/local-config.mjs'

// Pruebas de punta a punta: varios teléfonos a la vez (quien paga, quien
// entra por el link, quien no tiene la app) contra el backend local, que
// corre sobre PostgreSQL con el mismo schema, las mismas reglas y el mismo
// tiempo real que Supabase.
//
//   npm run test:e2e           (levanta el backend local y la app solos)
//
// Requisito: PostgreSQL 16 escuchando en 127.0.0.1:54329 (ver README).
const APP_PORT = 5190

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    locale: 'es-EC',
    timezoneId: 'America/Guayaquil',
    trace: 'off',
  },
  webServer: [
    {
      command: 'node tests/backend/gateway.mjs',
      url: `${GATEWAY_URL}/__test/health`,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
    },
    {
      command: `npx vite --port ${APP_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${APP_PORT}`,
      reuseExistingServer: !process.env.CI,
      env: { VITE_SUPABASE_URL: GATEWAY_URL, VITE_SUPABASE_ANON_KEY: ANON_KEY },
    },
  ],
})
