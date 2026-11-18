import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';

import { createdGroupInviteDto, groupInviteDto, MAX_INVITES_PER_USER_PER_DAY, type CreatedGroupInviteDto, type GroupInviteDto } from '@hogaria/shared';

import { CurrentUser } from '../../common/auth/decorators.js';
import { AppError } from '../../common/errors/app-error.js';
import { CurrentGroup, type GroupContext } from '../../common/guards/group-context.js';
import { GroupScoped, isUuid } from '../../common/guards/group-member.guard.js';
import { RateLimit } from '../../common/security/rate-limit.js';
import { ApiContract } from '../../openapi/api-contract.decorator.js';
import { InvitesService } from './invites.service.js';

import type { AuthUser } from '../../common/auth/auth-user.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Invitaciones de un grupo (solo miembros). */
@GroupScoped()
@Controller('groups/:groupId/invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @ApiContract({ summary: 'Crear una invitación (el token solo se devuelve aquí)', response: createdGroupInviteDto })
  @RateLimit(MAX_INVITES_PER_USER_PER_DAY, DAY_MS)
  @Post()
  create(@CurrentGroup() group: GroupContext, @CurrentUser() user: AuthUser): Promise<CreatedGroupInviteDto> {
    return this.invites.create(group.groupId, user);
  }

  @ApiContract({ summary: 'Invitaciones activas y las de los últimos 30 días', response: z.array(groupInviteDto) })
  @Get()
  list(@CurrentGroup() group: GroupContext): Promise<GroupInviteDto[]> {
    return this.invites.list(group.groupId);
  }

  @ApiContract({ summary: 'Revocar una invitación activa', response: groupInviteDto })
  @Delete(':inviteId')
  revoke(@CurrentGroup() group: GroupContext, @CurrentUser() user: AuthUser, @Param('inviteId') inviteId: string): Promise<GroupInviteDto> {
    if (!isUuid(inviteId)) throw new AppError('NOT_FOUND');
    return this.invites.revoke(group.groupId, inviteId, user.id);
  }
}
