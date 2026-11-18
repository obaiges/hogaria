import { Body, Controller, Delete, Get, HttpCode, Param, Patch } from '@nestjs/common';

import { groupMemberDto, updateMyMemberInput, type GroupMemberDto, type UpdateMyMemberInput } from '@hogaria/shared';

import { CurrentUser } from '../../common/auth/decorators.js';
import { CurrentGroup, type GroupContext } from '../../common/guards/group-context.js';
import { GroupScoped } from '../../common/guards/group-member.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ApiContract } from '../../openapi/api-contract.decorator.js';
import { MembersService } from './members.service.js';

import type { AuthUser } from '../../common/auth/auth-user.js';

/** `GET /groups/:groupId/members`, `PATCH …/members/me` y `DELETE …/members/:userId` (spec 02 §5). */
@GroupScoped()
@Controller('groups/:groupId/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @ApiContract({ summary: 'Miembros del hogar por fecha de alta', response: groupMemberDto.array() })
  @Get()
  list(@CurrentGroup() group: GroupContext): Promise<GroupMemberDto[]> {
    return this.members.list(group.groupId);
  }

  @ApiContract({ summary: 'Cambiar mi color de calle', body: updateMyMemberInput, response: groupMemberDto })
  @Patch('me')
  updateMine(
    @CurrentGroup() group: GroupContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateMyMemberInput)) body: UpdateMyMemberInput,
  ): Promise<GroupMemberDto> {
    return this.members.updateMine(group.groupId, user.id, body);
  }

  @ApiContract({ summary: 'Expulsar a otro miembro del hogar', response: null })
  @Delete(':userId')
  @HttpCode(204)
  async remove(@CurrentGroup() group: GroupContext, @CurrentUser() user: AuthUser, @Param('userId') userId: string): Promise<void> {
    await this.members.remove(group.groupId, user.id, userId);
  }
}
