import { expect, test } from '@playwright/test';

import { createUser, loginAs, resetDb } from './helpers';

// E2E-04 (HOG-105, HOG-103): A crea un hogar → genera un enlace → B (usuario existente) se une → ambos se ven en MIEMBROS.
test.describe('E2E-04 · invitar a un hogar', () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test('crear hogar, invitar y ver a los dos miembros', async ({ browser }) => {
    const ana = await createUser({ name: 'Ana' });
    const luis = await createUser({ name: 'Luis' });

    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale, timezoneId } = test.info().project.use;
    const options = { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale, timezoneId };
    const contextA = await browser.newContext(options);
    const contextB = await browser.newContext(options);
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // A crea el hogar desde "Tus hogares".
      await loginAs(pageA, ana);
      await pageA.goto('/grupos');
      await pageA.getByRole('button', { name: 'Crear hogar' }).first().click();
      const createSheet = pageA.getByRole('dialog', { name: 'Crear hogar' });
      await createSheet.getByLabel('Nombre del hogar').fill('Casa e2e');
      await createSheet.getByRole('button', { name: 'Crear hogar' }).click();
      await expect(pageA).toHaveURL(/\/g\/[0-9a-f-]{36}$/);
      const groupId = new URL(pageA.url()).pathname.split('/')[2] ?? '';

      // A genera el enlace en los ajustes del grupo.
      await pageA.goto(`/g/${groupId}/ajustes`);
      await expect(pageA.getByRole('heading', { name: 'Miembros (1)' })).toBeVisible();
      await pageA.getByRole('button', { name: 'Invitar a alguien' }).click();
      const linkSheet = pageA.getByRole('dialog', { name: 'Enlace de invitación' });
      await expect(linkSheet.getByText(/Este enlace solo se muestra ahora/)).toBeVisible();
      const url = await linkSheet.getByLabel('Enlace').inputValue();
      const token = new URL(url).pathname.split('/').pop() ?? '';
      expect(token).toHaveLength(43);
      await linkSheet.getByRole('button', { name: 'Cerrar' }).click();
      await expect(pageA.getByText(/Creada por Ana · caduca en \d+ días/)).toBeVisible();

      // B (ya registrado) abre el enlace y se une (HOG-103).
      await loginAs(pageB, luis);
      await pageB.goto(`/invite/${token}`);
      await pageB.getByRole('button', { name: 'Unirme a Casa e2e' }).click();
      await expect(pageB).toHaveURL(new RegExp(`/g/${groupId}$`));

      // Los dos se ven como miembros.
      await pageB.goto(`/g/${groupId}/ajustes`);
      await expect(pageB.getByRole('heading', { name: 'Miembros (2)' })).toBeVisible();
      await expect(pageB.getByText('Ana', { exact: true })).toBeVisible();

      await pageA.reload();
      await expect(pageA.getByRole('heading', { name: 'Miembros (2)' })).toBeVisible();
      await expect(pageA.getByText('Luis', { exact: true })).toBeVisible();
      await expect(pageA.getByText('Usada por Luis')).toBeAttached();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
