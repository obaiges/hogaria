import { expect, test } from '@playwright/test';

import { createInvite, createUser, lastEmailLink, resetDb } from './helpers';

// E2E-01 (HOG-103): abrir una invitación sin cuenta → registrarse → verificar el email → aterrizar en el hogar.
test.describe('E2E-01 · registro con invitación', () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test('el enlace de invitación lleva al registro y, tras verificar, al hogar', async ({ page }) => {
    const ana = await createUser({ name: 'Ana', group: { name: 'Casa e2e' } });
    const { token } = await createInvite(ana);

    await page.goto(`/invite/${token}`);
    await expect(page.getByText('Ana te invita a unirte a')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Casa e2e/ })).toBeVisible();
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page).toHaveURL(/\/registro$/);

    const email = 'nuevo@e2e.local';
    await page.getByLabel('Nombre', { exact: true }).fill('Nuevo');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Nombre de usuario').fill('nuevo_e2e');
    await page.getByLabel('Contraseña', { exact: true }).fill('piscina-azul-2026');
    await page.getByLabel('Repite la contraseña').fill('piscina-azul-2026');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText(/Te hemos enviado un enlace/)).toBeVisible();

    await page.goto(await lastEmailLink(email));
    await expect(page).toHaveURL(new RegExp(`/g/${ana.groupId}$`));
  });

  test('una invitación revocada o inexistente muestra "Invitación no válida o caducada"', async ({ page }) => {
    await page.goto('/invite/no-existe-este-token-de-invitacion-xxxxxxxxxxx');
    await expect(page.getByText('Invitación no válida o caducada')).toBeVisible();
    await page.getByRole('button', { name: 'Ir a Hogaria' }).click();
    await expect(page).toHaveURL(/\/entrar/);
  });
});
