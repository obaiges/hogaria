import { Logger } from '@nestjs/common';
import { APIError } from 'better-auth/api';

import { hashInviteToken, INVITE_COOKIE } from '../modules/groups/invite-token.js';
import { CLIENT_IP_HEADER } from './auth-hooks.js';

import type { SecurityEventRecorder } from '../security-events/security-event.service.js';
import type { PrismaClient } from '@prisma/client';

/**
 * Consumo de la invitación para un usuario recién creado. Lo implementa
 * `InvitesService.consumeForNewUser` (spec 02, RN-02-17); se enlaza en tiempo de
 * ejecución porque Better Auth se crea antes que el módulo de grupos.
 */
export interface SignupInviteConsumer {
  consumeForNewUser(token: string, userId: string): Promise<unknown>;
}

/** Enlace tardío entre Better Auth y `InvitesService` (sin dependencia circular de módulos). */
export class SignupInviteConsumerRef {
  private consumer: SignupInviteConsumer | null = null;

  set(consumer: SignupInviteConsumer): void {
    this.consumer = consumer;
  }

  get(): SignupInviteConsumer {
    if (!this.consumer) throw new Error('SignupInviteConsumerRef: InvitesService no está registrado');
    return this.consumer;
  }
}

export interface InviteHookDeps {
  prisma: PrismaClient;
  securityEvents: SecurityEventRecorder;
  consumer: SignupInviteConsumerRef;
  /** `SIGNUP_REQUIRES_INVITE` (por defecto `true`, RN-01-01). */
  requireInvite: boolean;
  cookieDomain?: string;
  secureCookies: boolean;
}

/** Lo que usamos del contexto de endpoint que Better Auth pasa a los `databaseHooks`. */
interface EndpointCtx {
  path?: string;
  headers?: Headers;
  request?: Request;
  getCookie?: (name: string) => string | null | undefined;
  setCookie?: (name: string, value: string, options?: Record<string, unknown>) => unknown;
}

export const INVITE_REQUIRED_MESSAGE = 'Necesitas una invitación para registrarte';
export const SIGN_UP_EMAIL_PATH = '/sign-up/email';

function headersOf(ctx: EndpointCtx): Headers | undefined {
  return ctx.request?.headers ?? ctx.headers;
}

function readCookie(ctx: EndpointCtx, name: string): string | null {
  const direct = ctx.getCookie?.(name);
  if (direct) return direct;
  const raw = headersOf(ctx)?.get('cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * `databaseHooks.user` que exigen invitación al crear cualquier usuario, por email o por
 * Google (spec 01, RN-01-01 a RN-01-06):
 * - `assertSignUpInvite` (hook de petición de `/sign-up/email`) y `create.before` (resto de
 *   altas, p. ej. el callback de Google): la cookie `hogaria_invite` debe apuntar a una
 *   invitación `ACTIVE`; si no, `403 INVITE_REQUIRED` y `SecurityEvent
 *   SIGNUP_REJECTED_NO_INVITE`. En el callback de Google, Better Auth convierte el error
 *   en `errorURL?error=INVITE_REQUIRED`. El registro por email se comprueba antes porque
 *   Better Auth enmascara los 403 de los `databaseHooks` del sign-up como un 200 genérico.
 * - `create.after` (tras el commit del usuario): consume la invitación, registra
 *   `SIGNUP_WITH_INVITE` y borra la cookie. Si la invitación ya no vale (carrera), el
 *   usuario se queda sin grupo y solo se avisa en el log (RN-01-05).
 * Las creaciones internas, sin petición (CLI `create-owner`, RN-01-30), no pasan por aquí.
 * Los usuarios de Google que ya existen no se crean, así que entran sin invitación.
 */
export function createInviteDatabaseHooks({ prisma, securityEvents, consumer, requireInvite, cookieDomain, secureCookies }: InviteHookDeps) {
  const logger = new Logger('SignupInvite');

  async function isActive(token: string): Promise<boolean> {
    const invite = await prisma.groupInvite.findFirst({
      where: { tokenHash: hashInviteToken(token), usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    return invite !== null;
  }

  function clearCookie(ctx: EndpointCtx): void {
    ctx.setCookie?.(INVITE_COOKIE, '', {
      maxAge: 0,
      path: '/api/auth',
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookies,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    });
  }

  /** Sin invitación activa (y con `requireInvite`) → `SecurityEvent` y `403 INVITE_REQUIRED` (RN-01-03). */
  async function assertSignUpInvite(ctx: EndpointCtx, email: string | null): Promise<void> {
    const token = readCookie(ctx, INVITE_COOKIE);
    if (token && (await isActive(token))) return;
    if (!requireInvite) return;

    const headers = headersOf(ctx);
    await securityEvents.record('SIGNUP_REJECTED_NO_INVITE', {
      identifier: email,
      ip: headers?.get(CLIENT_IP_HEADER) ?? null,
      userAgent: headers?.get('user-agent') ?? null,
    });
    throw new APIError('FORBIDDEN', { code: 'INVITE_REQUIRED', message: INVITE_REQUIRED_MESSAGE });
  }

  return {
    /** Para el hook de petición de `/sign-up/email` (antes de que Better Auth cree nada). */
    assertSignUpInvite: (ctx: unknown, email: string | null) => assertSignUpInvite(ctx as EndpointCtx, email),
    create: {
      before: async (user: { email?: string | null }, context: unknown) => {
        if (!context) return;
        const ctx = context as EndpointCtx;
        // El registro por email ya se comprobó en el hook de petición (`assertSignUpInvite`):
        // aquí un 403 lo convertiría Better Auth en un 200 genérico (protección contra
        // enumeración). Una carrera entre ambos acaba en "usuario sin grupo" (RN-01-05).
        if (ctx.path === SIGN_UP_EMAIL_PATH) return;
        await assertSignUpInvite(ctx, user.email ?? null);
      },

      after: async (user: { id: string }, context: unknown) => {
        if (!context) return;
        const ctx = context as EndpointCtx;
        const token = readCookie(ctx, INVITE_COOKIE);
        if (!token) return;
        clearCookie(ctx);
        try {
          await consumer.get().consumeForNewUser(token, user.id);
        } catch (error) {
          logger.warn({ err: error, userId: user.id }, 'Usuario creado sin grupo: la invitación ya no se podía consumir (RN-01-05)');
          return;
        }
        const headers = headersOf(ctx);
        await securityEvents.record('SIGNUP_WITH_INVITE', {
          userId: user.id,
          ip: headers?.get(CLIENT_IP_HEADER) ?? null,
          userAgent: headers?.get('user-agent') ?? null,
        });
      },
    },
  };
}
