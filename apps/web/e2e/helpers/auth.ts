import { E2E_API_URL, E2E_WEB_URL } from './env';

import type { TestUser } from './api';
import type { Page } from '@playwright/test';

/**
 * Inicia sesión como `user` en el contexto de `page` con un login real de Better Auth
 * (`POST /api/auth/sign-in/email`) hecho desde ese contexto, así que la cookie
 * `hogaria.session_token` queda en su almacén. En local la cookie es del host
 * `localhost` y vale para la web (:4173) y la API (:3100). Cuando existan las
 * pantallas (HOG-053) se puede añadir una variante por UI.
 */
export async function loginAs(page: Page, user: TestUser): Promise<void> {
  const res = await page.context().request.post(`${E2E_API_URL}/api/auth/sign-in/email`, {
    data: { email: user.email, password: user.password },
    headers: { Origin: E2E_WEB_URL },
  });
  if (!res.ok()) throw new Error(`loginAs(${user.email}) falló: ${res.status()} ${await res.text()}`);
}
