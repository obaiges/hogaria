import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ActivityService } from '../src/activity/activity.service.js';
import { RealtimePublisher } from '../src/realtime/realtime.publisher.js';
import { MaintenanceCron } from '../src/scheduler/maintenance.cron.js';
import { createGroupWithMembers } from './factories/index.js';
import { useFakeRealtimePublisher, type FakeRealtimePublisher } from './fakes/index.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';

import type { Group, User } from '@prisma/client';

const prisma = getTestPrisma();
const DAY = 24 * 60 * 60 * 1000;

describe('ActivityService y retención (HOG-153)', () => {
  let t: TestApp;
  let activity: ActivityService;
  let realtime: FakeRealtimePublisher;
  let group: Group;
  let user: User;

  beforeAll(async () => {
    t = await createTestApp({ configure: useFakeRealtimePublisher });
    activity = t.app.get(ActivityService);
    realtime = t.app.get(RealtimePublisher) as FakeRealtimePublisher;
  });

  beforeEach(async () => {
    realtime.clear();
    const created = await createGroupWithMembers(1);
    group = created.group;
    user = created.users[0]!;
  });

  afterAll(async () => {
    await t.close();
  });

  const input = () => ({
    groupId: group.id,
    actorId: user.id,
    entityType: 'group' as const,
    entityId: group.id,
    action: 'updated' as const,
    summary: 'cambió el nombre del hogar a «Casa»',
    metadata: { field: 'name' },
  });

  it('record dentro de una transacción que se completa deja la fila, y publishCreated la publica', async () => {
    const row = await prisma.$transaction((tx) => activity.record(tx, input()));
    activity.publishCreated(row);

    const stored = await prisma.activityLog.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored).toMatchObject({ groupId: group.id, actorId: user.id, entityType: 'group', action: 'updated', metadata: { field: 'name' } });
    expect(realtime.ofEvent('activity.created')).toEqual([
      expect.objectContaining({ groupId: group.id, data: expect.objectContaining({ id: row.id, summary: input().summary }) }),
    ]);
  });

  it('una transacción que falla después de record no deja fila', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await activity.record(tx, input());
        throw new Error('fallo después de registrar');
      }),
    ).rejects.toThrow('fallo después de registrar');
    expect(await prisma.activityLog.count({ where: { groupId: group.id } })).toBe(0);
  });

  it('la purga borra lo antiguo y conserva lo reciente (actividad 90 días, SecurityEvent 180)', async () => {
    const now = Date.now();
    const at = (days: number) => new Date(now - days * DAY);
    const base = { groupId: group.id, actorId: user.id, entityType: 'group', entityId: group.id, action: 'updated', summary: 'x' };
    await prisma.activityLog.createMany({
      data: [
        { ...base, summary: 'vieja', createdAt: at(91) },
        { ...base, summary: 'reciente', createdAt: at(89) },
      ],
    });
    await prisma.securityEvent.deleteMany(); // el login de las factories también escribe eventos
    await prisma.securityEvent.createMany({
      data: [
        { userId: user.id, type: 'LOGIN_FAILED', identifier: 'viejo', createdAt: at(181) },
        { userId: user.id, type: 'LOGIN_FAILED', identifier: 'reciente', createdAt: at(179) },
      ],
    });

    const result = await t.app.get(MaintenanceCron).runNow(new Date(now));
    expect(result).toEqual({ ran: true, failed: [] });

    const summaries = (await prisma.activityLog.findMany({ where: { groupId: group.id } })).map((a) => a.summary);
    expect(summaries).toEqual(['reciente']);
    expect((await prisma.securityEvent.findMany()).map((e) => e.identifier)).toEqual(['reciente']);
  });
});
