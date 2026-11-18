import { Controller, Get } from '@nestjs/common';
import { z } from 'zod';

import { myGroupDto, type MyGroupDto } from '@hogaria/shared';

import { CurrentUser } from '../../common/auth/decorators.js';
import { ApiContract } from '../../openapi/api-contract.decorator.js';
import { GroupsService } from './groups.service.js';

import type { AuthUser } from '../../common/auth/auth-user.js';

@Controller('me/groups')
export class MeGroupsController {
  constructor(private readonly groups: GroupsService) {}

  @ApiContract({ summary: 'Hogares del usuario (por fecha de entrada)', tags: ['groups'], response: z.array(myGroupDto) })
  @Get()
  list(@CurrentUser() user: AuthUser): Promise<MyGroupDto[]> {
    return this.groups.listForUser(user.id);
  }
}
