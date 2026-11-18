import { expect, test, type Page } from '@playwright/test';

import { createUser, resetDb } from './helpers';

async function signIn(page: Page, identifier: string, password: string) {
  await page.goto('/entrar');
  await page.getByLabel('Email o nombre de usuario').fill(identifier);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

// E2E-02 (HOG-056): login con username, cerrar sesión y volver a entrar; login fallido con error genérico.
test.describe('E2E-02 · entrar y cerrar sesión', () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test('entra con el nombre de usuario, cierra sesión desde Perfil y vuelve a entrar', async ({ page }) => {
    const user = await createUser({ username: 'ana_e2e', password: 'piscina-azul-2026' });

    await signIn(page, 'Ana_E2E', user.password);
    await expect(page).not.toHaveURL(/\/entrar/);

    await page.goto('/perfil');
    await expect(page.getByRole('heading', { name: 'Seguridad' })).toBeVisible();
    await expect(page.getByText('Este dispositivo')).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).last().click();
    await expect(page).toHaveURL(/\/entrar$/);

    // Sin sesión, las rutas privadas vuelven a /entrar.
    await page.goto('/perfil');
    await expect(page).toHaveURL(/\/entrar\?volver=%2Fperfil/);

    await signIn(page, user.username, user.password);
    await expect(page).not.toHaveURL(/\/entrar/);
  });

  test('un login fallido muestra el error genérico', async ({ page }) => {
    const user = await createUser({ username: 'leo_e2e', password: 'piscina-azul-2026' });
    await signIn(page, user.username, 'contraseña-equivocada');
    await expect(page.getByRole('alert')).toContainText('Email, usuario o contraseña incorrectos');
    await expect(page).toHaveURL(/\/entrar/);
  });
});
