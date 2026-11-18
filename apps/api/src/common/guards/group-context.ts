import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { LaneColor } from '@prisma/client';
import type { Request } from 'express';

/** Contexto del grupo de la petición, lo rellena el `GroupMemberGuard` (RN-02-27). */
export interface GroupContext {
  groupId: string;
  /** Zona horaria IANA del grupo: los servicios la usan para interpretar los días. */
  timezone: string;
  /** `GroupMember.id` del usuario actual en este grupo. */
  memberId: string;
  laneColor: LaneColor;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- única forma de ampliar el Request de Express
  namespace Express {
    interface Request {
      /** Lo rellena el `GroupMemberGuard`; solo existe en rutas con `@GroupScoped()`. */
      groupContext?: GroupContext;
    }
  }
}

/** `{ groupId, timezone, memberId, laneColor }` del grupo de la ruta (requiere `@GroupScoped()`). */
export const CurrentGroup = createParamDecorator((_data: unknown, ctx: ExecutionContext): GroupContext => {
  const group = ctx.switchToHttp().getRequest<Request>().groupContext;
  // Solo pasa si el controlador no lleva @GroupScoped(): es un error de programación.
  if (!group) throw new Error('@CurrentGroup() usado en una ruta sin @GroupScoped()');
  return group;
});
