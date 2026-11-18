import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { activityDto, encodeCursor, paginated } from '@hogaria/shared';

import { createGroupWithMembers, createUser, loginAs } from './factories/index.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';

const prisma = getTestPrisma();
const page = paginated(activityDto);

/** Entradas con `id` creciente (UUIDv7 por defecto): la última es la más reciente. */
async function seedActivity(groupId: string, actorIds: Array<string | null>): Promise<string[]> {
  const ids: string[] = [];
  for (const [i, actorId] of actorIds.entries()) {
    const row = await prisma.activityLog.create({
      data: { groupId, actorId, entityType: 'group', entityId: groupId, action: 'updated', summary: `cambio ${i}` },
    });
    ids.push(row.id);
  }
  return ids;
}

describe('GET /groups/:g/activity (HOG-154, RN-03-30)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  const url = (groupId: string) => `/api/v1/groups/${groupId}/activity`;

  it('pagina por id descendente con nextCursor hasta el final', async () => {
    const { group, users } = await createGroupWithMembers(1);
    const ids = await seedActivity(group.id, Array.from({ length: 5 }, () => users[0]!.id));
    const agent = await loginAs(users[0]!, t.server);

    const first = page.parse((await agent.get(url(group.id)).query({ limit: 2 }).expect(200)).body);
    expect(first.items.map((i) => i.id)).toEqual([ids[4], ids[3]]);
    expect(first.nextCursor).toEqual(expect.any(String));

    const second = page.parse((await agent.get(url(group.id)).query({ limit: 2, cursor: first.nextCursor }).expect(200)).body);
    expect(second.items.map((i) => i.id)).toEqual([ids[2], ids[1]]);

    const third = page.parse((await agent.get(url(group.id)).query({ limit: 2, cursor: second.nextCursor }).expect(200)).body);
    expect(third.items.map((i) => i.id)).toEqual([ids[0]]);
    expect(third.nextCursor).toBeNull();
  });

  it('resuelve actorName; null para el sistema y para una cuenta borrada', async () => {
    const { group, users } = await createGroupWithMembers(1, { members: [{ name: 'Ana' }] });
    const deletedUserId = randomUUID();
    await seedActivity(group.id, [users[0]!.id, null, deletedUserId]);
    const agent = await loginAs(users[0]!, t.server);

    const { items } = page.parse((await agent.get(url(group.id)).expect(200)).body);
    expect(items.map((i) => [i.actorId, i.actorName])).toEqual([
      [deletedUserId, null],
      [null, null],
      [users[0]!.id, 'Ana'],
    ]);
  });

  it('solo la actividad de ese grupo', async () => {
    const a = await createGroupWithMembers(1);
    const b = await createGroupWithMembers(1);
    await seedActivity(a.group.id, [a.users[0]!.id]);
    await seedActivity(b.group.id, [b.users[0]!.id]);
    const agent = await loginAs(a.users[0]!, t.server);
    const { items } = page.parse((await agent.get(url(a.group.id)).expect(200)).body);
    expect(items.every((i) => i.groupId === a.group.id)).toBe(true);
  });

  it('cursor corrupto → 422; limit fuera de rango → 422', async () => {
    const { group, users } = await createGroupWithMembers(1);
    const agent = await loginAs(users[0]!, t.server);
    await agent.get(url(group.id)).query({ cursor: 'no-es-un-cursor' }).expect(422);
    await agent.get(url(group.id)).query({ cursor: encodeCursor([1, 2]) }).expect(422);
    await agent.get(url(group.id)).query({ limit: 101 }).expect(422);
  });

  it('sin sesión → 401; usuario de otro grupo → 404', async () => {
    const { group } = await createGroupWithMembers(1);
    await request(t.server).get(url(group.id)).expect(401);
    const stranger = await createUser();
    const agent = await loginAs(stranger, t.server);
    await agent.get(url(group.id)).expect(404);
  });
});
