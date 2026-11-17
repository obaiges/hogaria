import { setupServer } from "msw/node";

export { delay, http, HttpResponse } from "msw";

/** Base de la API en los tests (ver `test.env.VITE_API_URL` en vite.config.ts). */
export const TEST_API_URL = "http://api.test";

/** `apiUrl('/groups')` → `http://api.test/api/v1/groups`, la URL que pide `apiClient`. */
export function apiUrl(path: string): string {
  return `${TEST_API_URL}/api/v1${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Servidor MSW compartido por todos los tests (arrancado en `setup.ts`). Cada test
 * añade sus respuestas con `server.use(http.get(apiUrl('/x'), () => HttpResponse.json(...)))`;
 * se limpian después de cada test. Una petición sin manejar hace fallar el test.
 */
export const server = setupServer();
