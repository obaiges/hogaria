import { Module } from '@nestjs/common';

import { GroupLifecycleHooks } from './group-lifecycle.hooks.js';
import { GroupController, GroupsController } from './groups.controller.js';
import { GroupsService } from './groups.service.js';
import { MeGroupsController } from './me-groups.controller.js';

@Module({
  controllers: [GroupsController, GroupController, MeGroupsController],
  providers: [GroupsService, GroupLifecycleHooks],
  exports: [GroupsService, GroupLifecycleHooks],
})
export class GroupsModule {}
