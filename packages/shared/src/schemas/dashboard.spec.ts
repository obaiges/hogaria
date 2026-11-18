import { describe, expect, it } from 'vitest';

import { dashboardDto, dashboardQuery } from './dashboard.js';

describe('dashboardQuery (RN-15-19)', () => {
  it('acepta una fecha válida o ninguna', () => {
    expect(dashboardQuery.parse({ date: '2026-11-18' })).toEqual({ date: '2026-11-18' });
    expect(dashboardQuery.parse({})).toEqual({});
  });

  it('rechaza formatos y fechas que no existen', () => {
    expect(dashboardQuery.safeParse({ date: '18/11/2026' }).success).toBe(false);
    expect(dashboardQuery.safeParse({ date: '2026-13-40' }).success).toBe(false);
    expect(dashboardQuery.safeParse({ date: '2026-02-30' }).success).toBe(false);
  });
});

describe('dashboardDto', () => {
  it('la respuesta de fase 1 no lleva claves opcionales', () => {
    const dto = dashboardDto.parse({
      date: '2026-11-18',
      timezone: 'Europe/Madrid',
      members: [{ userId: '0193a0b2-0000-7000-8000-000000000001', name: 'Ana', image: null, laneColor: 'CORAL', isMe: true }],
      lanes: [{ userId: '0193a0b2-0000-7000-8000-000000000001' }],
      activity: [],
    });
    expect(Object.keys(dto).sort()).toEqual(['activity', 'date', 'lanes', 'members', 'timezone']);
    expect(Object.keys(dto.lanes[0]!)).toEqual(['userId']);
  });
});
