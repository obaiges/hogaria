import { Logger } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError } from 'better-auth/api';
import { username } from 'better-auth/plugins';

import {
  isValidUsername,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from '@hogaria/shared';

import { uuidv7 } from '../common/ids/uuidv7.js';
import { CLIENT_IP_HEADER, createAuthHooks } from './auth-hooks.js';
import { resetPasswordEmail } from './emails/reset-password.js';
import { verifyEmail } from './emails/verify-email.js';
import { createInviteDatabaseHooks, SignupInviteConsumerRef } from './invite-hooks.js';
import { AuthRequestLimiter } from './rate-limit/auth-request-limiter.js';
import { LoginRateLimiter } from './rate-limit/login-rate-limiter.js';

import type { EmailMessage, EmailSender } from '../email/email-sender.js';
import type { SecurityEventRecorder } from '../security-events/security-event.service.js';
import type { PrismaClient } from '@prisma/client';

export const AUTH = Symbol('AUTH');
export const AUTH_BASE_PATH = '/api/auth';

/** 365 días con renovación deslizante diaria (RN-01-20). */
export const SESSION_EXPIRES_IN_S = 365 * 24 * 60 * 60;
export const SESSION_UPDATE_AGE_S = 24 * 60 * 60;
/** El enlace de verificación caduca a las 24 h (RN-01-11). */
export const EMAIL_VERIFICATION_EXPIRES_IN_S = 24 * 60 * 60;
/** El enlace de restablecimiento caduca a los 30 min (RN-01-17). */
export const RESET_PASSWORD_EXPIRES_IN_S = 30 * 60;

export interface AuthEnv {
  NODE_ENV?: string;
  /** Origen de la web: `trustedOrigins` y destino tras verificar el email. */
  APP_URL?: string;
  /** Origen de la API: `baseURL` de Better Auth. */
  API_URL?: string;
  /** `.hogaria.obaiges.com` en producción; vacío en local (cookie del host). */
  COOKIE_DOMAIN?: string;
  BETTER_AUTH_SECRET?: string;
  /** `'false'` desactiva la exigencia de invitación (RN-01-01); cualquier otro valor, activa. */
  SIGNUP_REQUIRES_INVITE?: string;
}

export interface AuthDeps {
  prisma: PrismaClient;
  emailSender: EmailSender;
  securityEvents: SecurityEventRecorder;
  env: AuthEnv;
  /** Por defecto, nuevos (en memoria). Los tests pueden pasar los suyos. */
  loginLimiter?: LoginRateLimiter;
  requestLimiter?: AuthRequestLimiter;
  /** Enlace a `InvitesService.consumeForNewUser` (lo registra el módulo de grupos). */
  inviteConsumer?: SignupInviteConsumerRef;
}

function origin(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/** RN-01-12: tras verificar, Better Auth redirige a `APP_URL/`. */
export function withAppCallback(url: string, appUrl: string | undefined): string {
  const app = origin(appUrl);
  if (!app) return url;
  const parsed = new URL(url);
  parsed.searchParams.set('callbackURL', `${app}/`);
  return parsed.toString();
}

/**
 * Better Auth en `/api/auth/*` (spec 01, RN-01-07 a RN-01-12, RN-01-20, RN-01-21):
 * email + contraseña con verificación obligatoria, plugin `username`, ids UUIDv7,
 * sesión de 365 días deslizante sin caché de cookie y cookies `hogaria.*` compartidas
 * entre subdominios cuando hay `COOKIE_DOMAIN`.
 *
 * Es una factoría (no un `auth` global) para que Nest le inyecte Prisma y el
 * `EmailSender` (en test, `FakeEmailSender`). Se registra con el token `AUTH`.
 */
/**
 * Un fallo del proveedor de email se registra y no se propaga: la respuesta al usuario
 * sigue siendo la genérica y no revela si la cuenta existe (HOG-054).
 */
function createSafeSend(emailSender: EmailSender) {
  const logger = new Logger('AuthEmails');
  return async (message: EmailMessage): Promise<void> => {
    try {
      await emailSender.send(message);
    } catch (error) {
      logger.error(`No se ha podido enviar "${message.subject}": ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

export function createAuth({ prisma, emailSender, securityEvents, env, loginLimiter, requestLimiter, inviteConsumer }: AuthDeps) {
  const appOrigin = origin(env.APP_URL);
  const sendEmail = createSafeSend(emailSender);
  const cookieDomain = env.COOKIE_DOMAIN?.trim();
  const { assertSignUpInvite, ...inviteHooks } = createInviteDatabaseHooks({
    prisma,
    securityEvents,
    consumer: inviteConsumer ?? new SignupInviteConsumerRef(),
    requireInvite: env.SIGNUP_REQUIRES_INVITE?.trim().toLowerCase() !== 'false',
    cookieDomain: cookieDomain || undefined,
    secureCookies: env.NODE_ENV === 'production',
  });
  const hooks = createAuthHooks({
    prisma,
    securityEvents,
    loginLimiter: loginLimiter ?? new LoginRateLimiter(),
    requestLimiter: requestLimiter ?? new AuthRequestLimiter(),
    assertSignUpInvite,
  });

  return betterAuth({
    appName: 'Hogaria',
    baseURL: origin(env.API_URL),
    basePath: AUTH_BASE_PATH,
    // En producción la variable es obligatoria (config/env.ts). En desarrollo y test,
    // si falta, Better Auth usa su secreto de desarrollo y avisa.
    secret: env.BETTER_AUTH_SECRET || undefined,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    trustedOrigins: appOrigin ? [appOrigin] : [],
    telemetry: { enabled: false },
    // Los límites de /api/auth/* son los nuestros (RN-01-26/27, auth-hooks.ts).
    rateLimit: { enabled: false },
    hooks,
    // Errores de los callbacks de OAuth (p. ej. Google sin invitación) → `/entrar?error=<código>` (RN-01-06).
    ...(appOrigin ? { onAPIError: { errorURL: `${appOrigin}/entrar` } } : {}),

    // Campos propios de Hogaria que viajan con la sesión (el AuthGuard los usa sin otra
    // consulta). `input: false`: nadie puede fijarlos desde el registro.
    user: {
      additionalFields: {
        isPlatformAdmin: { type: 'boolean', required: false, defaultValue: false, input: false },
        blockedAt: { type: 'date', required: false, input: false },
      },
    },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      requireEmailVerification: true,
      // RN-01-16/17: Better Auth solo llama a `sendResetPassword` si la cuenta existe; la
      // respuesta de `/request-password-reset` es la misma en ambos casos.
      resetPasswordTokenExpiresIn: RESET_PASSWORD_EXPIRES_IN_S,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }, request) => {
        await securityEvents.record('PASSWORD_RESET_REQUESTED', {
          userId: user.id,
          ip: request?.headers.get(CLIENT_IP_HEADER) ?? null,
          userAgent: request?.headers.get('user-agent') ?? null,
        });
        await sendEmail(resetPasswordEmail({ to: user.email, url }));
      },
      onPasswordReset: async ({ user }, request) => {
        await securityEvents.record('PASSWORD_CHANGED', {
          userId: user.id,
          ip: request?.headers.get(CLIENT_IP_HEADER) ?? null,
          userAgent: request?.headers.get('user-agent') ?? null,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: EMAIL_VERIFICATION_EXPIRES_IN_S,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail(verifyEmail({ to: user.email, name: user.name, url: withAppCallback(url, env.APP_URL) }));
      },
    },

    plugins: [
      username({
        minUsernameLength: USERNAME_MIN_LENGTH,
        maxUsernameLength: USERNAME_MAX_LENGTH,
        usernameValidator: isValidUsername,
      }),
    ],

    databaseHooks: {
      // RN-01-01 a RN-01-06: ningún usuario sin invitación válida (invite-hooks.ts).
      user: inviteHooks,
      session: {
        create: {
          // RN-01-25: un usuario bloqueado no puede crear sesión.
          before: async (session) => {
            const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { blockedAt: true } });
            if (user?.blockedAt) {
              throw new APIError('FORBIDDEN', { code: 'ACCOUNT_BLOCKED', message: 'Tu cuenta está bloqueada. Habla con el administrador.' });
            }
          },
        },
      },
    },

    session: {
      expiresIn: SESSION_EXPIRES_IN_S,
      updateAge: SESSION_UPDATE_AGE_S,
      // Sin caché: cada petición consulta la sesión y una revocación es inmediata (RN-01-21).
      cookieCache: { enabled: false },
    },

    advanced: {
      cookiePrefix: 'hogaria',
      useSecureCookies: env.NODE_ENV === 'production',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
      crossSubDomainCookies: cookieDomain ? { enabled: true, domain: cookieDomain } : { enabled: false },
      database: { generateId: () => uuidv7() },
      // IP real del cliente (configureApp la pone desde req.ip, con trust proxy).
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
