import { test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { createUser, type TestUser } from './api';
import { loginAs } from './auth';

export interface Member {
  page: Page;
  context: BrowserContext;
  user: TestUser;
}

export interface TwoMembers {
  a: Member;
  b: Member;
  groupId: string;
  /** Cierra los dos contextos. */
  close: () => Promise<void>;
}

/**
 * Dos miembros del mismo hogar, cada uno en su contexto de navegador independiente
 * (cookies y almacenamiento propios) y con el dispositivo del proyecto (Pixel 7 o
 * iPhone 14). Para los e2e de tiempo real (E2E-05).
 *
 * Por defecto inicia sesión con los dos (`loginAs`); `login: false` solo crea los usuarios
 * y las páginas.
 */
export async function twoMembers(browser: Browser, options: { login?: boolean } = {}): Promise<TwoMembers> {
  const { login = true } = options;
  const userA = await createUser({ name: 'Ana', group: { name: 'Casa e2e' } });
  if (!userA.groupId) throw new Error('twoMembers: el primer usuario no tiene hogar');
  const userB = await createUser({ name: 'Óscar', joinGroupId: userA.groupId });

  // Mismo dispositivo que el proyecto en curso (viewport, userAgent, táctil…).
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale, timezoneId } = test.info().project.use;
  const contextOptions = { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale, timezoneId };

  const contextA = await browser.newContext(contextOptions);
  const contextB = await browser.newContext(contextOptions);
  const a: Member = { context: contextA, page: await contextA.newPage(), user: userA };
  const b: Member = { context: contextB, page: await contextB.newPage(), user: userB };

  if (login) {
    await loginAs(a.page, a.user);
    await loginAs(b.page, b.user);
  }

  return {
    a,
    b,
    groupId: userA.groupId,
    close: async () => {
      await contextA.close();
      await contextB.close();
    },
  };
}
