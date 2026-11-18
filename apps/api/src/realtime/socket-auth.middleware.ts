import { fromNodeHeaders } from 'better-auth/node';

import type { Auth } from '../auth/auth.js';
import type { RealtimeSocketData } from './rooms.js';
import type { Socket } from 'socket.io';

/** Error de `connect_error` que recibe el cliente: `err.message` y `err.data.code`. */
export type SocketAuthErrorCode = 'UNAUTHENTICATED' | 'ACCOUNT_BLOCKED';

export interface SocketAuthError extends Error {
  data: { code: SocketAuthErrorCode };
}

export function socketAuthError(code: SocketAuthErrorCode): SocketAuthError {
  return Object.assign(new Error(code), { data: { code } });
}

type Next = (err?: Error) => void;

/**
 * Middleware `io.use` del handshake (RN-03-02):
 * - El `Origin` debe ser uno de los permitidos (`APP_URL` y, en desarrollo, localhost:5173).
 *   Sin `Origin` también se rechaza: los navegadores siempre lo mandan en WebSocket y en polling CORS.
 * - Sesión de Better Auth válida a partir de la cookie del handshake.
 * - Usuario no bloqueado.
 * Si algo falla, `next(err)` y el cliente recibe `connect_error`.
 */
export function createSocketAuthMiddleware(deps: { auth: Auth; allowedOrigins: readonly string[] }) {
  return async (socket: Socket, next: Next): Promise<void> => {
    try {
      const origin = socket.handshake.headers.origin;
      if (!origin || !deps.allowedOrigins.includes(origin)) return next(socketAuthError('UNAUTHENTICATED'));

      const session = await deps.auth.api.getSession({ headers: fromNodeHeaders(socket.handshake.headers) });
      if (!session) return next(socketAuthError('UNAUTHENTICATED'));
      if (session.user.blockedAt) return next(socketAuthError('ACCOUNT_BLOCKED'));

      const data: RealtimeSocketData = { userId: session.user.id, sessionId: session.session.id };
      socket.data = data;
      next();
    } catch {
      next(socketAuthError('UNAUTHENTICATED'));
    }
  };
}
