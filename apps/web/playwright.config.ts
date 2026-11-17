import process from 'node:process';

import { defineConfig, devices } from '@playwright/test';

import { E2E_API_PORT, E2E_API_URL, E2E_WEB_PORT, E2E_WEB_URL } from './e2e/helpers/env';

const CI = Boolean(process.env.CI);

/**
 * E2E (docs/07-testing.md): Mobile Chrome (Pixel 7) y Mobile Safari (iPhone 14).
 * Levanta la API con NODE_ENV=test contra `hogaria_test` y la web compilada (vite
 * preview, como en producción: origen distinto al de la API) en puertos propios para
 * no chocar con `pnpm dev`.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  // La BBDD de test es compartida y los tests la resetean: un worker.
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: E2E_WEB_URL,
    trace: 'on-first-retry',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
  },
  projects: [
    { name: 'Pixel 7', use: { ...devices['Pixel 7'] } },
    { name: 'iPhone 14', use: { ...devices['iPhone 14'] } },
  ],
  webServer: [
    {
      name: 'api',
      command: 'node scripts/e2e-server.ts',
      cwd: '../api',
      url: `${E2E_API_URL}/api/v1/health`,
      env: { E2E_API_PORT: String(E2E_API_PORT), E2E_WEB_URL },
      reuseExistingServer: !CI,
      timeout: 180_000,
      stdout: 'pipe',
    },
    {
      name: 'web',
      command: `node ./node_modules/vite/bin/vite.js build && node ./node_modules/vite/bin/vite.js preview --port ${E2E_WEB_PORT} --strictPort`,
      url: E2E_WEB_URL,
      env: { VITE_API_URL: E2E_API_URL },
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
  ],
});
