import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';

import { AppError } from '../errors/app-error.js';
import { getAuthUser, type AuthUser } from './auth-user.js';

import type { Request } from 'express';

export const IS_PUBLIC = Symbol('IS_PUBLIC');

/**
 * Ruta (o controlador) accesible sin sesión. Solo: `/health`, `/health/db`,
 * `GET /invites/:token` y test-support (docs/03 §Autorización, CHK-SEC-01).
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** `{ id, name, email, isPlatformAdmin, sessionId }` del usuario autenticado. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const user = getAuthUser(ctx.switchToHttp().getRequest<Request>());
  // Solo pasa si se usa en una ruta @Public(): es un error de programación.
  if (!user) throw new AppError('UNAUTHENTICATED');
  return user;
});
