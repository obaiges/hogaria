import { Module } from '@nestjs/common';

import { GroupLifecycleHooks } from './group-lifecycle.hooks.js';
import { GroupController, GroupsController } from './groups.controller.js';
import { GroupsService } from './groups.service.js';
import { InvitesController } from './invites.controller.js';
import { InvitesService } from './invites.service.js';
import { MeGroupsController } from './me-groups.controller.js';
import { MembersController } from './members.controller.js';
import { MembersService } from './members.service.js';
import { PublicInvitesController } from './public-invites.controller.js';

@Module({
  controllers: [GroupsController, GroupController, MeGroupsController, MembersController, InvitesController, PublicInvitesController],
  providers: [GroupsService, GroupLifecycleHooks, InvitesService, MembersService],
  exports: [GroupsService, GroupLifecycleHooks, InvitesService, MembersService],
})
export class GroupsModule {}
