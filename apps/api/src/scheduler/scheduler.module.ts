import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { MaintenanceCron } from './maintenance.cron.js';
import { RetentionJob } from './retention.job.js';
import { SchedulerTickRegistry } from './scheduler-tick.registry.js';

/**
 * Global: los módulos inyectan `SchedulerTickRegistry` y registran sus handlers en
 * `onModuleInit`. `MaintenanceCron` es el único `@Cron` de la API (ADR-004).
 */
@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [SchedulerTickRegistry, MaintenanceCron, RetentionJob],
  exports: [SchedulerTickRegistry, MaintenanceCron],
})
export class SchedulerModule {}
