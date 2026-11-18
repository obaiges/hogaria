import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';

import { ERROR_MESSAGES_ES, signUpInput } from '@hogaria/shared';
import { checkPasswordPolicy } from '@hogaria/shared/common-passwords';

import { normalizeIdentifier } from './rate-limit/sliding-window.js';

import type { SecurityEventRecorder } from '../security-events/security-event.service.js';
import type { AuthRequestLimiter } from './rate-limit/auth-request-limiter.js';
import type { LoginRateLimiter } from './rate-limit/login-rate-limiter.js';
import type { createSessionHooks } from './session-hooks.js';
import type { PrismaClient } from '@prisma/client';

/**
 * Cabecera con la IP real del cliente. La pone `configureApp` a partir de `req.ip`
 * (con `trust proxy` para Caddy) y **sustituye** cualquier valor que mande el cliente.
 */
export const CLIENT_IP_HEADER = 'x-hogaria-client-ip';

const SIGN_IN_PATHS = new Set(['/sign-in/email', '/sign-in/username']);

export interface AuthHookDeps {
  prisma: PrismaClient;
  securityEvents: SecurityEventRecorder;
  loginLimiter: LoginRateLimiter;
  requestLimiter: AuthRequestLimiter;
  /** Exige invitación en `/sign-up/email` (spec 01, RN-01-03; ver invite-hooks.ts). */
  assertSignUpInvite?: (ctx: unknown, email: string | null) => Promise<void>;
  /** Revocación de sesiones: `SESSION_REVOKED`, `session.revoked` y sockets (RN-01-22, session-hooks.ts). */
  sessionHooks?: SessionHooks;
}

type SessionHooks = ReturnType<typeof createSessionHooks>;

type HookCtx = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

function bodyOf(ctx: HookCtx): Record<string, unknown> {
  return ctx.body && typeof ctx.body === 'object' ? (ctx.body as Record<string, unknown>) : {};
}

function clientInfo(ctx: HookCtx) {
  const headers = ctx.request?.headers ?? ctx.headers;
  return {
    ip: headers?.get(CLIENT_IP_HEADER) ?? 'unknown',
    userAgent: headers?.get('user-agent') ?? null,
  };
}

function tooManyRequests(retryAfterS: number): APIError {
  return new APIError(
    'TOO_MANY_REQUESTS',
    { code: 'RATE_LIMITED', message: ERROR_MESSAGES_ES.RATE_LIMITED },
    { 'Retry-After': String(retryAfterS) },
  );
}

function assertPolicy(password: unknown, context: { email?: string | null; username?: string | null }): void {
  if (typeof password !== 'string') return; // Better Auth valida el tipo
  const message = checkPasswordPolicy(password, context);
  if (message) throw new APIError('UNPROCESSABLE_ENTITY', { code: 'VALIDATION_ERROR', message });
}

/** Registro: los campos con `signUpInput` de shared → `422 VALIDATION_ERROR` (spec 01 §5.1). */
function assertSignUpInput(body: Record<string, unknown>): void {
  const result = signUpInput.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new APIError('UNPROCESSABLE_ENTITY', { code: 'VALIDATION_ERROR', message: issue?.message ?? ERROR_MESSAGES_ES.VALIDATION_ERROR });
  }
}

function identifierOf(path: string, body: Record<string, unknown>): string {
  return normalizeIdentifier(path === '/sign-in/username' ? body.username : body.email);
}

/**
 * Hooks de Better Auth (spec 01, RN-01-10, RN-01-14, RN-01-26 a RN-01-29):
 * - `before`: límites de peticiones y de login; política de contraseñas en registro,
 *   restablecimiento y cambio; `LOGOUT` (antes de borrar la sesión).
 * - `after`: contadores de login (solo fallos de credenciales), `LOGIN_SUCCESS`,
 *   `LOGIN_FAILED` y `PASSWORD_CHANGED`.
 * Las llamadas internas (`auth.api.getSession()` del AuthGuard) no traen `request` y se
 * ignoran: no cuentan para los límites.
 */
export function createAuthHooks({ prisma, securityEvents, loginLimiter, requestLimiter, assertSignUpInvite, sessionHooks }: AuthHookDeps) {
  const before = createAuthMiddleware(async (ctx) => {
    if (!ctx.request) return;
    const { ip, userAgent } = clientInfo(ctx);
    const body = bodyOf(ctx);

    if (SIGN_IN_PATHS.has(ctx.path)) {
      const wait = loginLimiter.check(ip, identifierOf(ctx.path, body));
      if (wait !== null) throw tooManyRequests(wait);
    } else {
      const wait = requestLimiter.consume(ctx.path, ip, body.email);
      if (wait !== null) throw tooManyRequests(wait);
    }

    switch (ctx.path) {
      case '/sign-up/email':
        assertSignUpInput(body);
        assertPolicy(body.password, { email: body.email as string, username: body.username as string });
        await assertSignUpInvite?.(ctx, typeof body.email === 'string' ? body.email.trim().toLowerCase() : null);
        break;
      case '/reset-password': {
        const token = (body.token as string | undefined) ?? (ctx.query as { token?: string } | undefined)?.token;
        if (!token) break; // Better Auth responde INVALID_TOKEN
        const verification = await ctx.context.internalAdapter.findVerificationValue(`reset-password:${token}`);
        const user = verification ? await ctx.context.internalAdapter.findUserById(verification.value) : null;
        assertPolicy(body.newPassword, { email: user?.email, username: (user as { username?: string | null } | null)?.username });
        break;
      }
      case '/change-password': {
        const session = await getSessionFromCtx(ctx);
        assertPolicy(body.newPassword, { email: session?.user.email, username: (session?.user as { username?: string | null } | undefined)?.username });
        break;
      }
      case '/sign-out': {
        const session = await getSessionFromCtx(ctx);
        if (session) await securityEvents.record('LOGOUT', { userId: session.user.id, ip, userAgent });
        break;
      }
    }
    await sessionHooks?.before(ctx);
  });

  const after = createAuthMiddleware(async (ctx) => {
    if (!ctx.request) return;
    const { ip, userAgent } = clientInfo(ctx);
    const returned = ctx.context.returned;
    const failed = returned instanceof APIError;
    await sessionHooks?.after(ctx, failed, { ip, userAgent });

    if (SIGN_IN_PATHS.has(ctx.path)) {
      const identifier = identifierOf(ctx.path, bodyOf(ctx));
      if (!failed) {
        loginLimiter.recordSuccess(ip, identifier);
        const userId = ctx.context.newSession?.user.id ?? (returned as { user?: { id?: string } } | undefined)?.user?.id;
        await securityEvents.record('LOGIN_SUCCESS', { userId, ip, userAgent });
      } else if (returned.statusCode === 401) {
        // Solo cuentan los fallos de credenciales (no EMAIL_NOT_VERIFIED ni ACCOUNT_BLOCKED).
        loginLimiter.recordFailure(ip, identifier);
        const where = ctx.path === '/sign-in/username' ? { username: identifier } : { email: identifier };
        const user = identifier ? await prisma.user.findUnique({ where, select: { id: true } }) : null;
        await securityEvents.record('LOGIN_FAILED', { userId: user?.id, identifier, ip, userAgent });
      }
      return;
    }

    if (ctx.path === '/change-password' && !failed) {
      const userId = (returned as { user?: { id?: string } } | undefined)?.user?.id ?? (await getSessionFromCtx(ctx))?.user.id;
      await securityEvents.record('PASSWORD_CHANGED', { userId, ip, userAgent });
    }
  });

  return { before, after };
}
