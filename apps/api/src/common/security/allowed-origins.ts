const DEV_WEB_ORIGIN = 'http://localhost:5173';

function toOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Orígenes de la web que pueden llamar a la API con cookies (docs/03 §Protecciones web):
 * `APP_URL` y, solo en desarrollo, `http://localhost:5173`.
 */
export function getAllowedOrigins(env: { NODE_ENV?: string; APP_URL?: string }): string[] {
  const origins = new Set<string>();
  const app = env.APP_URL ? toOrigin(env.APP_URL) : null;
  if (app) origins.add(app);
  if (env.NODE_ENV === 'development') origins.add(DEV_WEB_ORIGIN);
  return [...origins];
}

export const UNSAFE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * `true` si la petición debe rechazarse con `FORBIDDEN_ORIGIN`: mutación con una
 * cabecera `Origin` presente y fuera de la lista. Sin `Origin` (curl, apps nativas,
 * navegadores en peticiones del mismo origen) no se bloquea; la cookie `SameSite=Lax`
 * cubre ese caso.
 */
export function isForbiddenOrigin(method: string, origin: string | undefined, allowed: readonly string[]): boolean {
  if (!UNSAFE_METHODS.has(method.toUpperCase())) return false;
  if (origin === undefined || origin === '') return false;
  return !allowed.includes(origin);
}
