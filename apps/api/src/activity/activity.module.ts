import { Global, Module } from '@nestjs/common';

import { ActivityService } from './activity.service.js';

/** Global: todos los módulos con mutaciones de grupo registran actividad (spec 03). */
@Global()
@Module({
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
