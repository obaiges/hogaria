import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { groupMemberDto } from '@hogaria/shared';

import { MembershipCache } from '../src/common/cache/membership-cache.js';
import { RealtimePublisher } from '../src/realtime/realtime.publisher.js';
import { createGroupWithMembers, createUser, loginAs } from './factories/index.js';
import { useFakeRealtimePublisher, type FakeRealtimePublisher } from './fakes/index.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';

const prisma = getTestPrisma();
const ORIGIN = 'https://hogaria.test';
const MUTATION = '0193a0b2-0000-7000-8000-0000000000aa';

describe('API de miembros (HOG-108)', () => {
  let t: TestApp;
  let realtime: FakeRealtimePublisher;

  beforeAll(async () => {
    t = await createTestApp({ configure: useFakeRealtimePublisher });
    realtime = t.app.get(RealtimePublisher) as FakeRealtimePublisher;
  });

  beforeEach(() => {
    realtime.clear();
    t.app.get(MembershipCache).clear();
  });

  afterAll(async () => {
    await t.close();
  });

  const members = (groupId: string) => `/api/v1/groups/${groupId}/members`;
  const me = (groupId: string) => `${members(groupId)}/me`;

  describe('GET /groups/:g/members', () => {
    it('lista los miembros por joinedAt asc con nombre, username e imagen', async () => {
      const { group, users } = await createGroupWithMembers(3, { members: [{ name: 'Ana' }, { name: 'Óscar' }, { name: 'Leo' }] });
      // El tercero se unió el primero: el orden es por joinedAt, no por creación.
      await prisma.groupMember.update({
        where: { groupId_userId: { groupId: group.id, userId: users[2]!.id } },
        data: { joinedAt: new Date('2020-01-01T00:00:00Z') },
      });
      await prisma.user.update({ where: { id: users[0]!.id }, data: { image: 'https://lh3.googleusercontent.com/a/ana' } });

      const agent = await loginAs(users[1]!, t.server);
      const res = await agent.get(members(group.id)).expect(200);
      const list = groupMemberDto.array().parse(res.body);
      expect(list.map((m) => m.name)).toEqual(['Leo', 'Ana', 'Óscar']);
      expect(list[1]).toMatchObject({
        groupId: group.id,
        userId: users[0]!.id,
        username: users[0]!.username,
        image: 'https://lh3.googleusercontent.com/a/ana',
        laneColor: 'CORAL',
      });
    });
  });

  describe('PATCH /groups/:g/members/me', () => {
    it('cambia el propio color → 200 groupMemberDto y publica group.member.updated sin actividad', async () => {
      const { group, users } = await createGroupWithMembers(2);
      const agent = await loginAs(users[1]!, t.server);

      const res = await agent.patch(me(group.id)).set('Origin', ORIGIN).set('X-Client-Mutation-Id', MUTATION).send({ laneColor: 'LEAF' }).expect(200);
      expect(groupMemberDto.parse(res.body)).toMatchObject({ userId: users[1]!.id, laneColor: 'LEAF' });
      expect(await prisma.groupMember.findUniqueOrThrow({ where: { groupId_userId: { groupId: group.id, userId: users[1]!.id } } })).toMatchObject({
        laneColor: 'LEAF',
      });
      expect(realtime.ofEvent('group.member.updated')).toEqual([
        expect.objectContaining({ groupId: group.id, actorId: users[1]!.id, clientMutationId: MUTATION, data: res.body }),
      ]);
      expect(await prisma.activityLog.count({ where: { groupId: group.id } })).toBe(0);
    });

    it('el mismo color que ya tiene → 200 sin evento', async () => {
      const { group, users } = await createGroupWithMembers(2);
      const agent = await loginAs(users[0]!, t.server);
      const res = await agent.patch(me(group.id)).set('Origin', ORIGIN).send({ laneColor: 'CORAL' }).expect(200);
      expect(res.body).toMatchObject({ userId: users[0]!.id, laneColor: 'CORAL' });
      expect(realtime.ofEvent('group.member.updated')).toHaveLength(0);
    });

    it('color de otro miembro → 409 CONFLICT "Ese color ya lo tiene {nombre}"', async () => {
      const { group, users } = await createGroupWithMembers(2, { members: [{ name: 'Ana' }, { name: 'Óscar' }] });
      const agent = await loginAs(users[1]!, t.server);
      const res = await agent.patch(me(group.id)).set('Origin', ORIGIN).send({ laneColor: 'CORAL' });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'CONFLICT', detail: 'Ese color ya lo tiene Ana' });
      expect(realtime.ofEvent('group.member.updated')).toHaveLength(0);
    });

    it('dos cambios simultáneos al mismo color → uno 200 y otro 409', async () => {
      const { group, users } = await createGroupWithMembers(3);
      const [a, b] = await Promise.all([loginAs(users[1]!, t.server), loginAs(users[2]!, t.server)]);

      const results = await Promise.all([
        a.patch(me(group.id)).set('Origin', ORIGIN).send({ laneColor: 'VIOLET' }),
        b.patch(me(group.id)).set('Origin', ORIGIN).send({ laneColor: 'VIOLET' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await prisma.groupMember.count({ where: { groupId: group.id, laneColor: 'VIOLET' } })).toBe(1);
      expect(realtime.ofEvent('group.member.updated')).toHaveLength(1);
    });

    it('color que no existe → 422 VALIDATION_ERROR', async () => {
      const { group, users } = await createGroupWithMembers(1);
      const agent = await loginAs(users[0]!, t.server);
      const res = await agent.patch(me(group.id)).set('Origin', ORIGIN).send({ laneColor: 'FUCSIA' });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('autorización', () => {
    it('sin sesión → 401', async () => {
      const { group } = await createGroupWithMembers(1);
      await request(t.server).get(members(group.id)).expect(401);
      await request(t.server).patch(me(group.id)).set('Origin', ORIGIN).send({ laneColor: 'LEAF' }).expect(401);
    });

    it('usuario de otro grupo, grupo inexistente o id no UUID → 404 con el mismo cuerpo', async () => {
      const { group } = await createGroupWithMembers(1);
      const outsider = await loginAs(await createUser(), t.server);

      const foreign = await outsider.get(members(group.id)).expect(404);
      const missing = await outsider.get(members('0193a0b2-0000-7000-8000-000000000999')).expect(404);
      await outsider.get(members('no-es-uuid')).expect(404);
      expect(missing.body.code).toBe(foreign.body.code);
      expect(missing.body.detail).toBe(foreign.body.detail);

      await outsider.patch(me(group.id)).set('Origin', ORIGIN).send({ laneColor: 'LEAF' }).expect(404);
      expect(await prisma.groupMember.count({ where: { groupId: group.id, laneColor: 'LEAF' } })).toBe(0);
    });
  });
});
