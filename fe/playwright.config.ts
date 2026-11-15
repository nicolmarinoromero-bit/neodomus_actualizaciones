import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  // Un reintento solo en CI (Semana 7/8: estabilidad medida en local con
  // --repeat-each; en local retries=0 para detectar el flakiness real).
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    // Reporte HTML de Playwright (receta week-07): `pnpm exec playwright show-report`
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5174',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
