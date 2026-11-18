import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_EXPENSE_CATEGORIES, groupDto, myGroupDto } from '@hogaria/shared';

import { MembershipCache } from '../src/common/cache/membership-cache.js';
import { uuidv7 } from '../src/common/ids/uuidv7.js';
import { GroupLifecycleHooks } from '../src/modules/groups/group-lifecycle.hooks.js';
import { RealtimePublisher } from '../src/realtime/realtime.publisher.js';
import { createGroupWithMembers, createUser, loginAs } from './factories/index.js';
import { useFakeRealtimePublisher, type FakeRealtimePublisher } from './fakes/index.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';

const prisma = getTestPrisma();
const ORIGIN = 'https://hogaria.test';
const MUTATION = '0193a0b2-0000-7000-8000-0000000000ff';

describe('API de grupos (HOG-100)', () => {
  let t: TestApp;
  let realtime: FakeRealtimePublisher;
  const timezoneChanged = vi.fn();

  beforeAll(async () => {
    t = await createTestApp({ configure: useFakeRealtimePublisher });
    realtime = t.app.get(RealtimePublisher) as FakeRealtimePublisher;
    t.app.get(GroupLifecycleHooks).register({ name: 'test', onGroupTimezoneChanged: timezoneChanged });
  });

  beforeEach(() => {
    realtime.clear();
    timezoneChanged.mockClear();
    t.app.get(MembershipCache).clear();
  });

  afterAll(async () => {
    await t.close();
  });

  describe('POST /groups', () => {
    it('crea el grupo con su semilla completa en una transacción → 201 myGroupDto', async () => {
      const user = await createUser({ name: 'Ana' });
      const agent = await loginAs(user, t.server);

      const res = await agent.post('/api/v1/groups').set('Origin', ORIGIN).send({ name: '  Casa Baiges ', emoji: '🐶' }).expect(201);
      const dto = myGroupDto.parse(res.body);
      expect(dto).toMatchObject({ name: 'Casa Baiges', emoji: '🐶', timezone: 'Europe/Madrid', createdById: user.id, memberCount: 1, myLaneColor: 'CORAL' });

      const groupId = dto.id;
      const members = await prisma.groupMember.findMany({ where: { groupId } });
      expect(members).toEqual([expect.objectContaining({ userId: user.id, laneColor: 'CORAL' })]);

      const lists = await prisma.shoppingList.findMany({ where: { groupId } });
      expect(lists).toEqual([expect.objectContaining({ name: 'Compra', emoji: '🛒', position: 0, createdById: user.id })]);

      const categories = await prisma.expenseCategory.findMany({ where: { groupId }, orderBy: { position: 'asc' } });
      expect(categories.map((c) => [c.position, c.name, c.emoji])).toEqual(DEFAULT_EXPENSE_CATEGORIES.map((c, i) => [i, c.name, c.emoji]));

      const activity = await prisma.activityLog.findMany({ where: { groupId } });
      expect(activity).toEqual([
        expect.objectContaining({ actorId: user.id, entityType: 'group', entityId: groupId, action: 'created', summary: 'creó el hogar 🐶 Casa Baiges' }),
      ]);
      expect(realtime.ofEvent('activity.created')).toEqual([
        expect.objectContaining({ groupId, actorId: user.id, data: expect.objectContaining({ actorName: 'Ana' }) }),
      ]);
    });

    it('el creador puede usar el grupo al momento aunque el guard cacheara un 404', async () => {
      const agent = await loginAs(await createUser(), t.server);
      const res = await agent.post('/api/v1/groups').set('Origin', ORIGIN).send({ name: 'Casa' }).expect(201);
      await agent.get(`/api/v1/groups/${res.body.id}`).expect(200);
    });

    it('datos inválidos → 422 y no se crea nada', async () => {
      const agent = await loginAs(await createUser(), t.server);
      const before = await prisma.group.count();
      for (const body of [{}, { name: '' }, { name: 'Casa', emoji: '🏠🏠' }, { name: 'Casa', timezone: 'Europe/Nowhere' }]) {
        const res = await agent.post('/api/v1/groups').set('Origin', ORIGIN).send(body).expect(422);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      }
      expect(await prisma.group.count()).toBe(before);
    });

    it('sin sesión → 401', async () => {
      await request(t.server).post('/api/v1/groups').set('Origin', ORIGIN).send({ name: 'Casa' }).expect(401);
    });
  });

  describe('GET /groups/:groupId', () => {
    it('miembro → groupDto', async () => {
      const { group, users } = await createGroupWithMembers(2);
      const agent = await loginAs(users[1]!, t.server);
      const res = await agent.get(`/api/v1/groups/${group.id}`).expect(200);
      expect(groupDto.parse(res.body)).toMatchObject({ id: group.id, name: group.name, emoji: group.emoji, timezone: 'Europe/Madrid' });
    });

    it('no miembro o inexistente → 404; sin sesión → 401', async () => {
      const { group } = await createGroupWithMembers(1);
      const outsider = await loginAs(await createUser(), t.server);
      await outsider.get(`/api/v1/groups/${group.id}`).expect(404);
      await outsider.get(`/api/v1/groups/${uuidv7()}`).expect(404);
      await request(t.server).get(`/api/v1/groups/${group.id}`).expect(401);
    });
  });

  describe('PATCH /groups/:groupId', () => {
    it('cambiar el nombre → groupDto, actividad y eventos tras el commit con el clientMutationId', async () => {
      const { group, users } = await createGroupWithMembers(2);
      const agent = await loginAs(users[1]!, t.server);

      const res = await agent
        .patch(`/api/v1/groups/${group.id}`)
        .set('Origin', ORIGIN)
        .set('X-Client-Mutation-Id', MUTATION)
        .send({ name: 'Piso nuevo' })
        .expect(200);
      expect(groupDto.parse(res.body)).toMatchObject({ id: group.id, name: 'Piso nuevo' });

      const activity = await prisma.activityLog.findMany({ where: { groupId: group.id } });
      expect(activity).toEqual([
        expect.objectContaining({ actorId: users[1]!.id, action: 'updated', summary: 'cambió el nombre del hogar a «Piso nuevo»', metadata: { fields: ['name'] } }),
      ]);
      expect(realtime.published.map((p) => p.envelope.event)).toEqual(['group.updated', 'activity.created']);
      expect(realtime.ofEvent('group.updated')[0]).toMatchObject({ groupId: group.id, actorId: users[1]!.id, clientMutationId: MUTATION, data: res.body });
      expect(timezoneChanged).not.toHaveBeenCalled();
    });

    it('sin cambios reales → 200 sin actividad ni eventos', async () => {
      const { group, users } = await createGroupWithMembers(1, { name: 'Casa', emoji: '🏠' });
      const agent = await loginAs(users[0]!, t.server);
      const res = await agent.patch(`/api/v1/groups/${group.id}`).set('Origin', ORIGIN).send({ name: 'Casa', emoji: '🏠', timezone: 'Europe/Madrid' }).expect(200);
      expect(res.body.updatedAt).toBe(group.updatedAt.toISOString());
      expect(await prisma.activityLog.count({ where: { groupId: group.id } })).toBe(0);
      expect(realtime.published).toEqual([]);
    });

    it('varios campos → "actualizó los datos del hogar"', async () => {
      const { group, users } = await createGroupWithMembers(1);
      const agent = await loginAs(users[0]!, t.server);
      await agent.patch(`/api/v1/groups/${group.id}`).set('Origin', ORIGIN).send({ name: 'Otra', emoji: '🐱' }).expect(200);
      const [entry] = await prisma.activityLog.findMany({ where: { groupId: group.id } });
      expect(entry).toMatchObject({ summary: 'actualizó los datos del hogar', metadata: { fields: ['name', 'emoji'] } });
    });

    it('cambiar la zona horaria invalida la caché del guard de todo el grupo y avisa a los módulos', async () => {
      const { group, users } = await createGroupWithMembers(2);
      const a = await loginAs(users[0]!, t.server);
      const cache = t.app.get(MembershipCache);
      await a.get(`/api/v1/groups/${group.id}`).expect(200);
      expect(cache.get(users[0]!.id, group.id)?.timezone).toBe('Europe/Madrid');
      cache.set(users[1]!.id, group.id, { memberId: 'x', laneColor: 'SEA', timezone: 'Europe/Madrid' });

      await a.patch(`/api/v1/groups/${group.id}`).set('Origin', ORIGIN).send({ timezone: 'Atlantic/Canary' }).expect(200);

      expect(cache.get(users[0]!.id, group.id)).toBeUndefined();
      expect(cache.get(users[1]!.id, group.id)).toBeUndefined();
      expect(timezoneChanged).toHaveBeenCalledWith(group.id);
      const [entry] = await prisma.activityLog.findMany({ where: { groupId: group.id } });
      expect(entry?.summary).toBe('cambió la zona horaria del hogar a Atlantic/Canary');
    });

    it('cuerpo vacío o inválido → 422; no miembro → 404; sin sesión → 401', async () => {
      const { group, users } = await createGroupWithMembers(1);
      const agent = await loginAs(users[0]!, t.server);
      await agent.patch(`/api/v1/groups/${group.id}`).set('Origin', ORIGIN).send({}).expect(422);
      await agent.patch(`/api/v1/groups/${group.id}`).set('Origin', ORIGIN).send({ timezone: 'Mars/Base' }).expect(422);

      const outsider = await loginAs(await createUser(), t.server);
      await outsider.patch(`/api/v1/groups/${group.id}`).set('Origin', ORIGIN).send({ name: 'Mío' }).expect(404);
      await request(t.server).patch(`/api/v1/groups/${group.id}`).set('Origin', ORIGIN).send({ name: 'Mío' }).expect(401);
      expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).name).toBe(group.name);
    });
  });

  describe('GET /me/groups', () => {
    it('grupos del usuario por joinedAt asc con memberCount y myLaneColor', async () => {
      const user = await createUser();
      const first = await createGroupWithMembers(3, { name: 'Primero' });
      const second = await createGroupWithMembers(1, { name: 'Segundo' });
      await createGroupWithMembers(1, { name: 'Ajeno' });
      await prisma.groupMember.create({ data: { groupId: first.group.id, userId: user.id, laneColor: 'LEAF', joinedAt: new Date('2026-01-01T00:00:00Z') } });
      await prisma.groupMember.create({ data: { groupId: second.group.id, userId: user.id, laneColor: 'SEA', joinedAt: new Date('2026-02-01T00:00:00Z') } });

      const agent = await loginAs(user, t.server);
      const res = await agent.get('/api/v1/me/groups').expect(200);
      const groups = res.body.map((g: unknown) => myGroupDto.parse(g));
      expect(groups.map((g: { name: string; memberCount: number; myLaneColor: string }) => [g.name, g.memberCount, g.myLaneColor])).toEqual([
        ['Primero', 4, 'LEAF'],
        ['Segundo', 2, 'SEA'],
      ]);
    });

    it('sin grupos → []; sin sesión → 401', async () => {
      const agent = await loginAs(await createUser(), t.server);
      await agent.get('/api/v1/me/groups').expect(200, []);
      await request(t.server).get('/api/v1/me/groups').expect(401);
    });
  });
});
