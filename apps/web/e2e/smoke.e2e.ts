import { expect, test } from '@playwright/test';

import { createUser, loginAs, resetDb, twoMembers } from './helpers';

// Humo (HOG-011): se ejecuta en Pixel 7 y en iPhone 14.
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

  test('twoMembers abre dos contextos independientes del mismo hogar', async ({ browser }) => {
    const members = await twoMembers(browser, { login: false });
    try {
      expect(members.a.user.groupId).toBe(members.groupId);
      expect(members.b.user.groupId).toBe(members.groupId);
      expect(members.b.user.laneColor).toBe('SEA');
      expect(members.a.context).not.toBe(members.b.context);

      await members.a.page.goto('/');
      await members.a.page.evaluate(() => localStorage.setItem('e2e', 'a'));
      await members.b.page.goto('/');
      expect(await members.b.page.evaluate(() => localStorage.getItem('e2e'))).toBeNull();
      expect(members.a.page.viewportSize()?.width).toBeLessThan(500);
    } finally {
      await members.close();
    }
  });

  test('loginAs avisa de que aún no está disponible (HOG-050)', async ({ page }) => {
    const user = await createUser();
    await expect(loginAs(page, user)).rejects.toThrow(/Not implemented/);
  });
});
