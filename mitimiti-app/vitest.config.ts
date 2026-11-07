import { defineConfig } from 'vitest/config'

// Pruebas unitarias de la lógica pura (dinero, división, saldos). Las de
// extremo a extremo viven en tests/e2e y corren con Playwright.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
