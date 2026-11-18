import { createHash, randomBytes } from 'node:crypto';

/** Cookie con el token en claro que lleva la invitación al registro (spec 01, RN-01-02). */
export const INVITE_COOKIE = 'hogaria_invite';
export const INVITE_COOKIE_MAX_AGE_MS = 60 * 60 * 1000;

/** 32 bytes aleatorios en base64url: 43 caracteres (spec 02, RN-02-10). */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 en hexadecimal: lo único que se guarda (`GroupInvite.tokenHash`, único). La
 * búsqueda es por igualdad, así que no hace falta comparación en tiempo constante.
 */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Quita el token de una URL para los logs: `/api/v1/invites/<token>…` → `/api/v1/invites/[redacted]…`. */
export function redactInviteToken(url: string): string {
  return url.replace(/(\/invites\/)[^/?#]+/g, '$1[redacted]');
}
