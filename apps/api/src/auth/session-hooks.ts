import { Logger } from '@nestjs/common';
import { getSessionFromCtx, type createAuthMiddleware } from 'better-auth/api';

import type { SecurityEventRecorder } from '../security-events/security-event.service.js';
import type { PrismaClient } from '@prisma/client';

type HookCtx = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/**
 * Avisa de sesiones revocadas (spec 01, RN-01-22): `session.revoked` a `user:<id>` y
 * desconexión de los sockets de esas sesiones. Lo implementa el módulo de tiempo real
 * (`SessionRevocationNotifier`), que se enlaza en tiempo de ejecución porque Better
 * Auth se crea antes que el gateway (el gateway depende de `AUTH`).
 */
export interface SessionRevocationListener {
  onSessionsRevoked(userId: string, sessionIds: string[]): Promise<void>;
}

/** Enlace tardío entre Better Auth y el tiempo real (sin dependencia circular). */
export class SessionRevocationRef {
  private listener: SessionRevocationListener | null = null;

  set(listener: SessionRevocationListener): void {
    this.listener = listener;
  }

  get(): SessionRevocationListener | null {
    return this.listener;
  }
}

/** Rutas de Better Auth que revocan sesiones del usuario actual (RN-01-22). */
export const REVOKING_PATHS = new Set(['/revoke-session', '/revoke-sessions', '/revoke-other-sessions', '/change-password', '/reset-password']);

interface PendingRevocation {
  userId: string;
  sessionIds: string[];
}

export interface SessionHookDeps {
  prisma: PrismaClient;
  securityEvents: SecurityEventRecorder;
  revocations: SessionRevocationRef;
}

function bodyOf(ctx: HookCtx): Record<string, unknown> {
  return ctx.body && typeof ctx.body === 'object' ? (ctx.body as Record<string, unknown>) : {};
}

/**
 * Hooks de revocación de sesiones. En `before` se anotan las sesiones que la ruta va a
 * borrar (después ya no existen); en `after`, si la operación fue bien, se comprueba
 * cuáles se borraron de verdad y, si hay alguna: `SecurityEvent SESSION_REVOKED` (uno
 * por operación), `session.revoked` y desconexión de sus sockets. `/sign-out` no pasa por
 * aquí: registra `LOGOUT` y no publica nada (RN-01-23, auth-hooks.ts).
 */
export function createSessionHooks({ prisma, securityEvents, revocations }: SessionHookDeps) {
  const logger = new Logger('SessionHooks');
  // Clave: la `Request` de la petición, la misma en `before` y en `after`.
  const pending = new WeakMap<Request, PendingRevocation>();

  async function candidates(ctx: HookCtx): Promise<PendingRevocation | null> {
    const body = bodyOf(ctx);
    if (ctx.path === '/reset-password') {
      const token = (body.token as string | undefined) ?? (ctx.query as { token?: string } | undefined)?.token;
      if (!token) return null;
      const verification = await ctx.context.internalAdapter.findVerificationValue(`reset-password:${token}`);
      if (!verification) return null;
      const sessions = await prisma.session.findMany({ where: { userId: verification.value }, select: { id: true } });
      return { userId: verification.value, sessionIds: sessions.map((s) => s.id) };
    }

    const current = await getSessionFromCtx(ctx);
    if (!current) return null;
    const userId = current.user.id;
    const currentId = current.session.id;

    switch (ctx.path) {
      case '/revoke-session': {
        if (typeof body.token !== 'string') return null;
        const target = await prisma.session.findFirst({ where: { token: body.token, userId }, select: { id: true } });
        return target ? { userId, sessionIds: [target.id] } : null;
      }
      case '/revoke-sessions': {
        const sessions = await prisma.session.findMany({ where: { userId }, select: { id: true } });
        return { userId, sessionIds: sessions.map((s) => s.id) };
      }
      case '/change-password':
      case '/revoke-other-sessions': {
        // `change-password` solo revoca las demás con `revokeOtherSessions` (RN-01-18).
        if (ctx.path === '/change-password' && body.revokeOtherSessions !== true) return null;
        const sessions = await prisma.session.findMany({ where: { userId, id: { not: currentId } }, select: { id: true } });
        return { userId, sessionIds: sessions.map((s) => s.id) };
      }
      default:
        return null;
    }
  }

  async function before(ctx: HookCtx): Promise<void> {
    if (!ctx.request || !REVOKING_PATHS.has(ctx.path)) return;
    const revocation = await candidates(ctx);
    if (revocation && revocation.sessionIds.length > 0) pending.set(ctx.request, revocation);
  }

  async function after(ctx: HookCtx, failed: boolean, info: { ip: string; userAgent: string | null }): Promise<void> {
    if (!ctx.request) return;
    const revocation = pending.get(ctx.request);
    if (!revocation) return;
    pending.delete(ctx.request);
    if (failed) return;

    const remaining = await prisma.session.findMany({ where: { id: { in: revocation.sessionIds } }, select: { id: true } });
    const left = new Set(remaining.map((s) => s.id));
    const revoked = revocation.sessionIds.filter((id) => !left.has(id));
    if (revoked.length === 0) return;

    await securityEvents.record('SESSION_REVOKED', { userId: revocation.userId, ip: info.ip, userAgent: info.userAgent });
    try {
      await revocations.get()?.onSessionsRevoked(revocation.userId, revoked);
    } catch (error) {
      // El borrado ya está hecho: un fallo del aviso en tiempo real no rompe la respuesta.
      logger.error({ err: error }, 'No se pudo avisar de las sesiones revocadas');
    }
  }

  return { before, after };
}
