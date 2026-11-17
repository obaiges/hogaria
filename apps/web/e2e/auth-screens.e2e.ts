import { expect, test } from '@playwright/test';

import { createUser, resetDb } from './helpers';

// Pantallas de auth contra la API real (HOG-053). Los flujos E2E-01/02/03 completos
// llegan con HOG-103, HOG-056 y HOG-052.
test.describe('pantallas de auth', () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test('sin sesión, una ruta privada lleva a /entrar?volver= y tras entrar se vuelve a ella', async ({ page }) => {
    const user = await createUser({ username: 'ana_e2e', password: 'piscina-azul-2026' });

    await page.goto('/grupos');
    await expect(page).toHaveURL(/\/entrar\?volver=%2Fgrupos$/);
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();

    await page.getByLabel('Email o nombre de usuario').fill('ANA_E2E');
    await page.getByLabel('Contraseña', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/grupos$/);

    // Con sesión, /entrar redirige.
    await page.goto('/entrar');
    await expect(page).toHaveURL(/\/grupos$/);
  });

  test('credenciales incorrectas → mensaje genérico', async ({ page }) => {
    await createUser({ email: 'leo@e2e.local', password: 'piscina-azul-2026' });
    await page.goto('/entrar');
    await page.getByLabel('Email o nombre de usuario').fill('leo@e2e.local');
    await page.getByLabel('Contraseña', { exact: true }).fill('otra-contraseña-mala');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Email, usuario o contraseña incorrectos');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`/entrar, /registro y /recuperar se ven a 375 px en ${theme}`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: theme });
      for (const path of ['/entrar', '/registro', '/recuperar']) {
        await page.goto(path);
        await expect(page.locator('h1')).toBeVisible();
        // Sin scroll horizontal a 375 px (DoD).
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        await page.screenshot({ path: info.outputPath(`${path.slice(1)}-${theme}.png`), fullPage: true });
      }
    });
  }
});
