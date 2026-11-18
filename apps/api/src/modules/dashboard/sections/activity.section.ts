import { Injectable } from '@nestjs/common';

import { ActivityFeedService } from '../../../activity/activity-feed.service.js';

import type { DashboardContext, DashboardSectionProvider } from '../dashboard-section.provider.js';
import type { ActivityDto } from '@hogaria/shared';

/** Las 5 entradas más recientes del grupo, con el mismo `ActivityDto` que el feed (RN-15-29). */
export const DASHBOARD_ACTIVITY_LIMIT = 5;

@Injectable()
export class ActivitySection implements DashboardSectionProvider<'activity'> {
  readonly key = 'activity' as const;

  constructor(private readonly feed: ActivityFeedService) {}

  async load(ctx: DashboardContext): Promise<ActivityDto[]> {
    const page = await this.feed.list(ctx.groupId, { limit: DASHBOARD_ACTIVITY_LIMIT });
    return page.items;
  }
}
