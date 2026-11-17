import { expect, test, type Page } from '@playwright/test';

import { createUser, E2E_API_URL, loginAs, resetDb, twoMembers } from './helpers';

/** Sesión vista desde la página: fetch a la API con credenciales (CORS + cookie). */
async function sessionUserId(page: Page): Promise<string | null> {
  return page.evaluate(async (api) => {
    const res = await fetch(`${api}/api/auth/get-session`, { credentials: 'include' });
    const body = (await res.json()) as { user?: { id: string } } | null;
    return body?.user?.id ?? null;
  }, E2E_API_URL);
}

// Humo (HOG-011 / HOG-050): se ejecuta en Pixel 7 y en iPhone 14.
test.describe('humo', () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test('abre / y React monta la app', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle('Hogaria');
    await expect(page.locator('#root > *').first()).toBeVisible();
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  });

  test('la API de test-support responde a los helpers', async () => {
    const user = await createUser({ name: 'Ana', group: { name: 'Casa humo' } });
    expect(user).toMatchObject({ name: 'Ana', laneColor: 'CORAL', groupId: expect.any(String) });
  });

  test('loginAs deja la sesión de Better Auth en el contexto del navegador', async ({ page }) => {
    const user = await createUser();
    await page.goto('/');
    expect(await sessionUserId(page)).toBeNull();

    await loginAs(page, user);
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === 'hogaria.session_token');
    // SameSite=Lax lo comprueba auth-basic.int.spec.ts en la respuesta de la API: WebKit en
    // Windows informa de todas las cookies como SameSite=None en el almacén de Playwright.
    expect(session).toMatchObject({ httpOnly: true });
    expect(await sessionUserId(page)).toBe(user.userId);
  });

  test('twoMembers: dos contextos independientes del mismo hogar, cada uno con su sesión', async ({ browser }) => {
    const members = await twoMembers(browser);
    try {
      expect(members.a.user.groupId).toBe(members.groupId);
      expect(members.b.user.groupId).toBe(members.groupId);
      expect(members.b.user.laneColor).toBe('SEA');

      await members.a.page.goto('/');
      await members.b.page.goto('/');
      expect(await sessionUserId(members.a.page)).toBe(members.a.user.userId);
      expect(await sessionUserId(members.b.page)).toBe(members.b.user.userId);

      await members.a.page.evaluate(() => localStorage.setItem('e2e', 'a'));
      expect(await members.b.page.evaluate(() => localStorage.getItem('e2e'))).toBeNull();
      expect(members.a.page.viewportSize()?.width).toBeLessThan(500);
    } finally {
      await members.close();
    }
  });
});
