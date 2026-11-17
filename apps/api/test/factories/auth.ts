import type { User } from '@prisma/client';
import type request from 'supertest';

export type SessionAgent = ReturnType<typeof request.agent>;

/**
 * Agente de supertest con la cookie de sesión de `user`. Se implementa en HOG-050,
 * cuando exista Better Auth; hasta entonces lanza para que nadie lo use por error.
 */
export function loginAs(_user: User, _server?: unknown): Promise<SessionAgent> {
  return Promise.reject(new Error('Not implemented: loginAs llega con Better Auth (HOG-050)'));
}
