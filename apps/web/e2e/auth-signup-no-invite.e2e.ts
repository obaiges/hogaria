import { expect, test } from '@playwright/test';

import { resetDb } from './helpers';

// E2E-03 (HOG-052): sin invitación no se puede crear una cuenta (spec 01, RN-01-01/03).
test.describe('E2E-03 · registro sin invitación', () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test('el formulario se envía y el servidor lo rechaza con el mensaje de la spec', async ({ page }) => {
    await page.goto('/registro');
    await expect(page.getByText('Hogaria es solo por invitación. Si te han invitado, abre el enlace que te enviaron.')).toBeVisible();

    await page.getByLabel('Nombre', { exact: true }).fill('Sin Invitación');
    await page.getByLabel('Email').fill('sin-invitacion@e2e.local');
    await page.getByLabel('Nombre de usuario').fill('sin_invitacion');
    await page.getByLabel('Contraseña', { exact: true }).fill('piscina-azul-2026');
    await page.getByLabel('Repite la contraseña').fill('piscina-azul-2026');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByRole('alert')).toContainText('Necesitas una invitación para registrarte. Pide a alguien de tu hogar que te envíe un enlace.');
    // No pasa al estado "Revisa tu email": la cuenta no se ha creado.
    await expect(page.getByText(/Te hemos enviado un enlace/)).toHaveCount(0);
  });
});
