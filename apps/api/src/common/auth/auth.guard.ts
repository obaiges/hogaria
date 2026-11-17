import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';

import { AUTH, type Auth } from '../../auth/auth.js';
import { getRequestContext } from '../context/request-context.js';
import { AppError } from '../errors/app-error.js';
import { setAuthUser } from './auth-user.js';
import { IS_PUBLIC } from './decorators.js';

import type { Request } from 'express';

/**
 * Guard global (`APP_GUARD`): toda ruta exige sesión salvo `@Public()`.
 * - Una consulta de sesión por petición, sin caché (RN-01-21).
 * - Sin sesión → `401 UNAUTHENTICATED`; usuario bloqueado → `403 ACCOUNT_BLOCKED`.
 * - Rellena el `RequestContext` (userId, userName, sessionId) y `@CurrentUser()`.
 *
 * Se registra antes que el throttler para que este cuente por usuario.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new AppError('UNAUTHENTICATED');

    const { user } = session;
    if (user.blockedAt) throw new AppError('ACCOUNT_BLOCKED');

    setAuthUser(req, {
      id: user.id,
      name: user.name,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin === true,
      sessionId: session.session.id,
    });
    const ctx = getRequestContext();
    if (ctx) {
      ctx.userId = user.id;
      ctx.userName = user.name;
      ctx.sessionId = session.session.id;
    }
    return true;
  }
}
