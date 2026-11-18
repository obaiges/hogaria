import { Body, Controller, Get, Patch, Post } from '@nestjs/common';

import {
  createGroupInput,
  groupDto,
  myGroupDto,
  updateGroupInput,
  type CreateGroupInput,
  type GroupDto,
  type MyGroupDto,
  type UpdateGroupInput,
} from '@hogaria/shared';

import { CurrentUser } from '../../common/auth/decorators.js';
import { CurrentGroup, type GroupContext } from '../../common/guards/group-context.js';
import { GroupScoped } from '../../common/guards/group-member.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ApiContract } from '../../openapi/api-contract.decorator.js';
import { GroupsService } from './groups.service.js';

import type { AuthUser } from '../../common/auth/auth-user.js';

/** `POST /groups`: crear un hogar (no hay `:groupId`, así que sin `@GroupScoped`). */
@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @ApiContract({ summary: 'Crear un hogar con su semilla', body: createGroupInput, response: myGroupDto })
  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createGroupInput)) body: CreateGroupInput): Promise<MyGroupDto> {
    return this.groups.create(user.id, body);
  }
}

/** `GET` y `PATCH /groups/:groupId` (solo miembros). */
@GroupScoped()
@Controller('groups/:groupId')
export class GroupController {
  constructor(private readonly groups: GroupsService) {}

  @ApiContract({ summary: 'Datos del hogar', response: groupDto })
  @Get()
  get(@CurrentGroup() group: GroupContext): Promise<GroupDto> {
    return this.groups.get(group.groupId);
  }

  @ApiContract({ summary: 'Editar nombre, emoji o zona horaria', body: updateGroupInput, response: groupDto })
  @Patch()
  update(
    @CurrentGroup() group: GroupContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateGroupInput)) body: UpdateGroupInput,
  ): Promise<GroupDto> {
    return this.groups.update(group.groupId, user.id, body);
  }
}
