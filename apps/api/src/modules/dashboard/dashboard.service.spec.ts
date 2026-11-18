import { describe, expect, it } from 'vitest';

import { DashboardService, orderMembers } from './dashboard.service.js';

import type { DashboardContext, DashboardSectionProvider, DashboardSectionResults } from './dashboard-section.provider.js';
import type { GroupMemberDto } from '@hogaria/shared';

const G = '0193a0b2-0000-7000-8000-0000000000a1';
const ANA = '0193a0b2-0000-7000-8000-000000000001';
const LUIS = '0193a0b2-0000-7000-8000-000000000002';
const LEO = '0193a0b2-0000-7000-8000-000000000003';

const member = (userId: string, name: string, joinedAt: string): GroupMemberDto => ({
  id: `${userId.slice(0, -1)}9`,
  groupId: G,
  userId,
  name,
  username: null,
  image: null,
  laneColor: 'CORAL',
  joinedAt,
});
const members = [
  member(ANA, 'Ana', '2026-01-01T00:00:00.000Z'),
  member(LUIS, 'Luis', '2026-02-01T00:00:00.000Z'),
  member(LEO, 'Leo', '2026-03-01T00:00:00.000Z'),
];

function provider<K extends keyof DashboardSectionResults>(
  key: K,
  value: DashboardSectionResults[K],
  seen?: DashboardContext[],
): DashboardSectionProvider {
  return {
    key,
    load: (ctx) => {
      seen?.push(ctx);
      return Promise.resolve(value);
    },
  } as DashboardSectionProvider;
}

const base = (seen?: DashboardContext[]) => [provider('members', members, seen), provider('activity', [])];

describe('orderMembers (RN-15-22)', () => {
  it('el usuario actual primero y después por joinedAt', () => {
    expect(orderMembers(members, LEO).map((m) => m.name)).toEqual(['Leo', 'Ana', 'Luis']);
  });
});

describe('DashboardService', () => {
  it('fase 1: solo claves base, una calle por miembro sin sub-secciones e isMe', async () => {
    const dto = await new DashboardService(base()).get(G, LUIS, 'Europe/Madrid', { date: '2026-11-18' });
    expect(Object.keys(dto).sort()).toEqual(['activity', 'date', 'lanes', 'members', 'timezone']);
    expect(dto.lanes).toEqual([{ userId: LUIS }, { userId: ANA }, { userId: LEO }]);
    expect(dto.members.map((m) => [m.name, m.isMe])).toEqual([
      ['Luis', true],
      ['Ana', false],
      ['Leo', false],
    ]);
  });

  it('sin fecha usa hoy en la zona; calcula el rango con cambio de hora (25 h)', async () => {
    const seen: DashboardContext[] = [];
    const svc = new DashboardService(base(seen));
    const dto = await svc.get(G, ANA, 'Europe/Madrid', { date: '2026-10-25' });
    expect(dto.date).toBe('2026-10-25');
    const ctx = seen[0]!;
    expect(ctx.dayStartUtc.toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(ctx.dayEndUtc.toISOString()).toBe('2026-10-25T23:00:00.000Z');

    const today = await svc.get(G, ANA, 'Atlantic/Canary', {});
    expect(today.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('con providers de calle: rellena huecos y añade "Sin asignar" solo si hay tareas sin asignar', async () => {
    const task = { id: G, title: 'Basura', emoji: null, dueAt: '2026-11-18T10:00:00.000Z', allDay: false, overdue: false };
    const sections = [
      ...base(),
      provider('shifts', new Map([[ANA, { status: 'DAY_OFF' as const, slots: [], note: null }]])),
      provider('tasks', new Map([[null, { items: [task], moreCount: 0 }]])),
      provider('events', new Map()),
    ];
    const dto = await new DashboardService(sections).get(G, ANA, 'Europe/Madrid', { date: '2026-11-18' });
    expect(dto.lanes.map((l) => l.userId)).toEqual([ANA, LUIS, LEO, null]);
    expect(dto.lanes[0]).toMatchObject({ shift: { status: 'DAY_OFF' }, tasks: { items: [], moreCount: 0 }, events: { items: [] } });
    expect(dto.lanes[1]?.shift?.status).toBe('NO_SCHEDULE');
    expect(dto.lanes[3]).toEqual({ userId: null, tasks: { items: [task], moreCount: 0 } });
  });

  it('las secciones opcionales aparecen solo si hay provider', async () => {
    const shopping = { lists: [], totalPending: 0 };
    const dto = await new DashboardService([...base(), provider('shopping', shopping)]).get(G, ANA, 'Europe/Madrid', {});
    expect(dto.shopping).toEqual(shopping);
    expect('meals' in dto).toBe(false);
    expect('bills' in dto).toBe(false);
  });

  it('si una sección falla, falla todo (sin respuestas parciales)', async () => {
    const failing = { key: 'shopping', load: () => Promise.reject(new Error('boom')) } as DashboardSectionProvider;
    await expect(new DashboardService([...base(), failing]).get(G, ANA, 'Europe/Madrid', {})).rejects.toThrow('boom');
  });
});
