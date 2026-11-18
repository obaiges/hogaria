import { Injectable } from '@nestjs/common';

import { MembersService } from '../../groups/members.service.js';

import type { DashboardContext, DashboardSectionProvider } from '../dashboard-section.provider.js';
import type { GroupMemberDto } from '@hogaria/shared';

/** Miembros actuales por `joinedAt` (el servicio pone primero al usuario actual, RN-15-22). */
@Injectable()
export class MembersSection implements DashboardSectionProvider<'members'> {
  readonly key = 'members' as const;

  constructor(private readonly members: MembersService) {}

  load(ctx: DashboardContext): Promise<GroupMemberDto[]> {
    return this.members.list(ctx.groupId);
  }
}
