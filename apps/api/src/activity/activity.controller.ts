import { Controller, Get, Query } from '@nestjs/common';

import { activityDto, activityQuery, paginated, type ActivityDto, type ActivityQuery, type Paginated } from '@hogaria/shared';

import { CurrentGroup, type GroupContext } from '../common/guards/group-context.js';
import { GroupScoped } from '../common/guards/group-member.guard.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ApiContract } from '../openapi/api-contract.decorator.js';
import { ActivityFeedService } from './activity-feed.service.js';

/** `GET /groups/:groupId/activity` (spec 03 §5, RN-03-30). Solo lectura. */
@GroupScoped()
@Controller('groups/:groupId/activity')
export class ActivityController {
  constructor(private readonly feed: ActivityFeedService) {}

  @ApiContract({ summary: 'Actividad del hogar (90 días), de la más reciente a la más antigua', query: activityQuery, response: paginated(activityDto) })
  @Get()
  list(@CurrentGroup() group: GroupContext, @Query(new ZodValidationPipe(activityQuery)) query: ActivityQuery): Promise<Paginated<ActivityDto>> {
    return this.feed.list(group.groupId, query);
  }
}
