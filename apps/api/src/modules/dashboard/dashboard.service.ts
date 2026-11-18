import { Inject, Injectable } from '@nestjs/common';

import { todayInZone, zonedDayToUtcRange, type DashboardDto, type DashboardQuery, type GroupMemberDto, type LaneDto } from '@hogaria/shared';

import { DASHBOARD_SECTIONS, type DashboardContext, type DashboardSectionProvider, type DashboardSectionResults } from './dashboard-section.provider.js';

const EMPTY_LIST = { items: [], moreCount: 0 };
const NO_SCHEDULE: NonNullable<LaneDto['shift']> = { status: 'NO_SCHEDULE', slots: [], note: null };

/** RN-15-22: el usuario actual primero y después por `joinedAt` (orden estable). */
export function orderMembers(members: readonly GroupMemberDto[], userId: string): GroupMemberDto[] {
  return [...members].sort((a, b) => {
    if (a.userId === userId) return -1;
    if (b.userId === userId) return 1;
    return a.joinedAt.localeCompare(b.joinedAt);
  });
}

/**
 * Inicio (spec 15, RN-15-19 a RN-15-22): calcula el rango del día en la zona del grupo, ejecuta
 * en paralelo las secciones registradas y compone la respuesta. Si una falla, falla todo (500).
 */
@Injectable()
export class DashboardService {
  constructor(@Inject(DASHBOARD_SECTIONS) private readonly sections: readonly DashboardSectionProvider[]) {}

  async get(groupId: string, userId: string, timezone: string, query: DashboardQuery): Promise<DashboardDto> {
    const date = query.date ?? todayInZone(timezone);
    const { start, end } = zonedDayToUtcRange(date, timezone);
    const ctx: DashboardContext = { groupId, userId, date, dayStartUtc: start, dayEndUtc: end, timezone };

    const loaded = await Promise.all(this.sections.map(async (section) => [section.key, await section.load(ctx)] as const));
    const r = Object.fromEntries(loaded) as Partial<DashboardSectionResults>;
    if (!r.members || !r.activity) throw new Error('El Inicio necesita las secciones "members" y "activity"');

    const members = orderMembers(r.members, userId);
    const lane = (laneUserId: string | null): LaneDto => ({
      userId: laneUserId,
      ...(r.shifts && laneUserId !== null ? { shift: r.shifts.get(laneUserId) ?? NO_SCHEDULE } : {}),
      ...(r.tasks ? { tasks: r.tasks.get(laneUserId) ?? EMPTY_LIST } : {}),
      ...(r.events && laneUserId !== null ? { events: r.events.get(laneUserId) ?? EMPTY_LIST } : {}),
    });
    const lanes = members.map((m) => lane(m.userId));
    // "Sin asignar" solo si hay tareas de hoy sin asignar.
    if (r.tasks?.get(null)?.items.length) lanes.push(lane(null));

    return {
      date,
      timezone,
      members: members.map((m) => ({ userId: m.userId, name: m.name, image: m.image, laneColor: m.laneColor, isMe: m.userId === userId })),
      lanes,
      activity: r.activity,
      ...(r.meals ? { meals: r.meals } : {}),
      ...(r.bills ? { bills: r.bills } : {}),
      ...(r.shopping ? { shopping: r.shopping } : {}),
    };
  }
}
