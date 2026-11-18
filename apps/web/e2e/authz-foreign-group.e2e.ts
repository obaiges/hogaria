import { expect, test } from '@playwright/test';

import { createUser, loginAs, resetDb } from './helpers';

// E2E-15 (HOG-107, RN-02-31): la URL de un hogar ajeno muestra "No encontrado" sin filtrar sus datos.
test.describe('E2E-15 · grupo ajeno', () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test('abrir /g/<id de otro grupo>/compra muestra "No encontrado"', async ({ page }) => {
    const owner = await createUser({ name: 'Luis', group: { name: 'Casa de Luis' } });
    const stranger = await createUser({ name: 'Ana', group: { name: 'Casa de Ana' } });

    await loginAs(page, stranger);
    await page.goto(`/g/${owner.groupId}/compra`);

    await expect(page.getByRole('heading', { name: 'No encontrado' })).toBeVisible();
    await expect(page.getByText('Este hogar no existe o no formas parte de él.')).toBeVisible();
    await expect(page.getByText('Casa de Luis')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Ir a mis hogares' }).click();
    await expect(page).toHaveURL(/\/grupos$/);
  });

  test('su propio hogar carga y no muestra "No encontrado"', async ({ page }) => {
    const ana = await createUser({ name: 'Ana', group: { name: 'Casa de Ana' } });

    await loginAs(page, ana);
    await page.goto(`/g/${ana.groupId}/compra`);

    await expect(page.getByRole('heading', { name: 'Compra' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No encontrado' })).toHaveCount(0);
  });
});
