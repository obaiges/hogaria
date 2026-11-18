import { Module } from '@nestjs/common';

import { GroupsModule } from '../groups/groups.module.js';
import { DASHBOARD_SECTIONS, type DashboardSectionProvider } from './dashboard-section.provider.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { ActivitySection } from './sections/activity.section.js';
import { MembersSection } from './sections/members.section.js';

/**
 * Inicio (spec 15). Secciones de fase 1: `members` y `activity`. Cada épica añade la suya
 * importando su módulo aquí y sumando el provider a `inject` (RN-15-20).
 */
@Module({
  imports: [GroupsModule],
  controllers: [DashboardController],
  providers: [
    MembersSection,
    ActivitySection,
    {
      provide: DASHBOARD_SECTIONS,
      useFactory: (...sections: DashboardSectionProvider[]) => sections,
      inject: [MembersSection, ActivitySection],
    },
    DashboardService,
  ],
})
export class DashboardModule {}
