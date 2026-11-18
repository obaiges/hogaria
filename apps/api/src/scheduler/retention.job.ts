import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { ACTIVITY_RETENTION_DAYS } from '@hogaria/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import { SchedulerTickRegistry } from './scheduler-tick.registry.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const SECURITY_EVENT_RETENTION_DAYS = 180;
/** Como mucho una purga cada 24 h (RN-03-24). */
export const RETENTION_MIN_INTERVAL_MS = DAY_MS;

/**
 * Handler `retention.purge` (orden 20) del `MaintenanceCron` (spec 03, RN-03-24): borra la
 * actividad de más de 90 días y los `SecurityEvent` de más de 180. `lastRunAt` vive en
 * memoria: el primer tick tras arrancar la API purga, y después como mucho una vez al día.
 */
@Injectable()
export class RetentionJob implements OnModuleInit {
  private readonly logger = new Logger(RetentionJob.name);
  private lastRunAt: number | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: SchedulerTickRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register({ name: 'retention.purge', order: 20, run: async (now) => void (await this.run(now)) });
  }

  /** `true` si ha purgado; `false` si no tocaba (menos de 24 h desde la última). */
  async run(now: Date): Promise<boolean> {
    const at = now.getTime();
    if (this.lastRunAt !== null && at - this.lastRunAt < RETENTION_MIN_INTERVAL_MS) return false;
    this.lastRunAt = at;

    const activity = await this.prisma.activityLog.deleteMany({
      where: { createdAt: { lt: new Date(at - ACTIVITY_RETENTION_DAYS * DAY_MS) } },
    });
    const security = await this.prisma.securityEvent.deleteMany({
      where: { createdAt: { lt: new Date(at - SECURITY_EVENT_RETENTION_DAYS * DAY_MS) } },
    });
    this.logger.log({ activityLogs: activity.count, securityEvents: security.count }, 'Purga de retención');
    return true;
  }
}
