import { Controller, Get, Query } from '@nestjs/common';

import { dashboardDto, dashboardQuery, type DashboardDto, type DashboardQuery } from '@hogaria/shared';

import { CurrentUser } from '../../common/auth/decorators.js';
import { CurrentGroup, type GroupContext } from '../../common/guards/group-context.js';
import { GroupScoped } from '../../common/guards/group-member.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ApiContract } from '../../openapi/api-contract.decorator.js';
import { DashboardService } from './dashboard.service.js';

import type { AuthUser } from '../../common/auth/auth-user.js';

/** `GET /groups/:groupId/dashboard?date=YYYY-MM-DD` (spec 15 §5). */
@GroupScoped()
@Controller('groups/:groupId/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @ApiContract({ summary: 'Inicio del hogar para un día (por defecto, hoy en su zona horaria)', query: dashboardQuery, response: dashboardDto })
  @Get()
  get(
    @CurrentGroup() group: GroupContext,
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(dashboardQuery)) query: DashboardQuery,
  ): Promise<DashboardDto> {
    return this.dashboard.get(group.groupId, user.id, group.timezone, query);
  }
}
