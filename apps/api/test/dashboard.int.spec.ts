import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { dashboardDto, todayInZone } from '@hogaria/shared';

import { createGroupWithMembers, createUser, loginAs } from './factories/index.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';

const prisma = getTestPrisma();

describe('GET /groups/:g/dashboard (HOG-754, spec 15 §5)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  const url = (groupId: string) => `/api/v1/groups/${groupId}/dashboard`;

  it('respuesta de fase 1: claves base, calles con el usuario actual primero y las 5 últimas actividades', async () => {
    const { group, users } = await createGroupWithMembers(3, { members: [{ name: 'Ana' }, { name: 'Luis' }, { name: 'Leo' }] });
    await prisma.group.update({ where: { id: group.id }, data: { timezone: 'Atlantic/Canary' } });
    for (let i = 0; i < 7; i++) {
      await prisma.activityLog.create({
        data: { groupId: group.id, actorId: users[0]!.id, entityType: 'group', entityId: group.id, action: 'updated', summary: `cambio ${i}` },
      });
    }

    const agent = await loginAs(users[1]!, t.server);
    const dto = dashboardDto.parse((await agent.get(url(group.id)).expect(200)).body);

    expect(Object.keys(dto).sort()).toEqual(['activity', 'date', 'lanes', 'members', 'timezone']);
    expect(dto.timezone).toBe('Atlantic/Canary');
    expect(dto.date).toBe(todayInZone('Atlantic/Canary'));
    expect(dto.members.map((m) => [m.name, m.isMe])).toEqual([
      ['Luis', true],
      ['Ana', false],
      ['Leo', false],
    ]);
    expect(dto.lanes).toEqual(dto.members.map((m) => ({ userId: m.userId })));
    expect(dto.activity.map((a) => a.summary)).toEqual(['cambio 6', 'cambio 5', 'cambio 4', 'cambio 3', 'cambio 2']);
    expect(dto.activity[0]?.actorName).toBe('Ana');
  });

  it('respeta ?date', async () => {
    const { group, users } = await createGroupWithMembers(1);
    const agent = await loginAs(users[0]!, t.server);
    const dto = dashboardDto.parse((await agent.get(url(group.id)).query({ date: '2026-03-29' }).expect(200)).body);
    expect(dto.date).toBe('2026-03-29');
  });

  it('fecha con formato o valor no válido → 422', async () => {
    const { group, users } = await createGroupWithMembers(1);
    const agent = await loginAs(users[0]!, t.server);
    await agent.get(url(group.id)).query({ date: '2026-13-40' }).expect(422);
    await agent.get(url(group.id)).query({ date: '18-11-2026' }).expect(422);
  });

  it('sin sesión → 401; grupo ajeno → 404', async () => {
    const { group } = await createGroupWithMembers(1);
    await request(t.server).get(url(group.id)).expect(401);
    const stranger = await createUser();
    const agent = await loginAs(stranger, t.server);
    await agent.get(url(group.id)).expect(404);
  });
});
