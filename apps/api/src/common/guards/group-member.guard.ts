import { applyDecorators, Injectable, SetMetadata, UseGuards, type CanActivate, type ExecutionContext } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { getAuthUser } from '../auth/auth-user.js';
import { MembershipCache, type Membership } from '../cache/membership-cache.js';
import { AppError } from '../errors/app-error.js';

import type { Request } from 'express';

export const GROUP_SCOPED = Symbol('GROUP_SCOPED');

/**
 * Cualquier UUID en forma canónica (no solo v7): así Postgres nunca recibe un valor
 * que no pueda convertir a `uuid`, y un id con otra versión simplemente no existe.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Exige ser miembro del grupo `:groupId` de la ruta (RN-02-26 a RN-02-28).
 * - `groupId` no UUID, grupo inexistente o ajeno → `404 NOT_FOUND`, siempre con el mismo cuerpo.
 * - Resultado cacheado 60 s en `MembershipCache` (positivos y negativos).
 * - Deja `req.groupContext` (`@CurrentGroup()`).
 *
 * Se ejecuta después de los guards globales, así que el usuario ya está autenticado.
 * No se usa directamente: se aplica con `@GroupScoped()`.
 */
@Injectable()
export class GroupMemberGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: MembershipCache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = getAuthUser(req);
    if (!user) throw new AppError('UNAUTHENTICATED');

    if (!Object.hasOwn(req.params, 'groupId')) {
      throw new Error(`@GroupScoped() aplicado a una ruta sin :groupId (${req.method} ${req.path})`);
    }
    const groupId = req.params.groupId;
    if (!isUuid(groupId)) throw new AppError('NOT_FOUND');

    const membership = await this.resolve(user.id, groupId);
    if (!membership) throw new AppError('NOT_FOUND');

    req.groupContext = { groupId, ...membership };
    return true;
  }

  private async resolve(userId: string, groupId: string): Promise<Membership | null> {
    const cached = this.cache.get(userId, groupId);
    if (cached !== undefined) return cached;

    const row = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { id: true, laneColor: true, group: { select: { timezone: true } } },
    });
    const membership = row ? { memberId: row.id, laneColor: row.laneColor, timezone: row.group.timezone } : null;
    this.cache.set(userId, groupId, membership);
    return membership;
  }
}

/**
 * Decorador de clase obligatorio en todo controlador con `:groupId` en la ruta
 * (lo comprueba `test/group-scoped.int.spec.ts`). Aplica el `GroupMemberGuard`.
 */
export const GroupScoped = () => applyDecorators(SetMetadata(GROUP_SCOPED, true), UseGuards(GroupMemberGuard));
