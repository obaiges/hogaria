import { Global, Module } from '@nestjs/common';

import { ActivityFeedService } from './activity-feed.service.js';
import { ActivityController } from './activity.controller.js';
import { ActivityService } from './activity.service.js';

/** Global: todos los módulos con mutaciones de grupo registran actividad (spec 03). */
@Global()
@Module({
  controllers: [ActivityController],
  providers: [ActivityService, ActivityFeedService],
  exports: [ActivityService],
})
export class ActivityModule {}
