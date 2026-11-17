import type { Request } from 'express';

/** Usuario de la petición tras pasar el `AuthGuard` (lo inyecta `@CurrentUser()`). */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
  sessionId: string;
}

const AUTH_USER = Symbol('authUser');

type RequestWithUser = Request & { [AUTH_USER]?: AuthUser };

export function setAuthUser(req: Request, user: AuthUser): void {
  (req as RequestWithUser)[AUTH_USER] = user;
}

export function getAuthUser(req: Request): AuthUser | undefined {
  return (req as RequestWithUser)[AUTH_USER];
}
