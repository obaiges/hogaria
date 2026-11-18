import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { REALTIME_CHANNEL } from '@hogaria/shared';

import { MembershipCache } from '../src/common/cache/membership-cache.js';
import { GroupLifecycleHooks } from '../src/modules/groups/group-lifecycle.hooks.js';
import { MemberRemovedHooks } from '../src/modules/groups/member-removed.hooks.js';
import { RealtimeGateway } from '../src/realtime/realtime.gateway.js';
import { RealtimePublisher } from '../src/realtime/realtime.publisher.js';
import { groupRoom, userRoom } from '../src/realtime/rooms.js';
import { createGroupWithMembers, createUser, loginAs, sessionCookieFor } from './factories/index.js';
import { useFakeRealtimePublisher, type FakeRealtimePublisher } from './fakes/index.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';

import type { RealtimeEnvelope } from '@hogaria/shared';

const prisma = getTestPrisma();
const ORIGIN = 'https://hogaria.test';
const MUTATION = '0193a0b2-0000-7000-8000-0000000000bb';

const leaveUrl = (groupId: string) => `/api/v1/groups/${groupId}/leave`;
const memberUrl = (groupId: string, userId: string) => `/api/v1/groups/${groupId}/members/${userId}`;

async function seedGroupScopedRows(groupId: string, userId: string): Promise<void> {
  await prisma.reminder.create({
    data: {
      userId,
      groupId,
      sourceType: 'TASK',
      sourceId: '0193a0b2-0000-7000-8000-0000000000cc',
      occurrenceAt: new Date('2026-12-01T09:00:00Z'),
      fireAt: new Date('2026-12-01T08:00:00Z'),
      title: 'Sacar la basura',
      body: 'Hoy te toca',
      url: `/g/${groupId}/tareas`,
    },
  });
  await prisma.aiConversation.create({ data: { groupId, userId, title: 'Cena' } });
}

describe('Salir y expulsar (HOG-106, RN-02-20 a RN-02-23)', () => {
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

  describe('POST /groups/:g/leave', () => {
    it('con más miembros: borra el miembro, escribe "salió del hogar" y publica left antes que activity', async () => {
      const { group, users } = await createGroupWithMembers(2);
      const leaver = users[1]!;
      const agent = await loginAs(leaver, t.server);

      await agent.post(leaveUrl(group.id)).set('Origin', ORIGIN).set('X-Client-Mutation-Id', MUTATION).expect(204);

      expect(await prisma.groupMember.count({ where: { groupId: group.id, userId: leaver.id } })).toBe(0);
      expect(await prisma.group.count({ where: { id: group.id } })).toBe(1);
      const activity = await prisma.activityLog.findMany({ where: { groupId: group.id, action: 'left' } });
      expect(activity).toEqual([expect.objectContaining({ actorId: leaver.id, entityType: 'group_member', summary: 'salió del hogar' })]);

      const events = realtime.published.map((p) => p.envelope.event);
      expect(events.indexOf('group.member.left')).toBeLessThan(events.indexOf('activity.created'));
      expect(realtime.ofEvent('group.member.left')).toEqual([
        expect.objectContaining({ groupId: group.id, actorId: leaver.id, clientMutationId: MUTATION, data: { userId: leaver.id } }),
      ]);

      // Ya no es miembro: 404 al instante (la caché del guard se invalida).
      await agent.get(`/api/v1/groups/${group.id}`).expect(404);
    });

    it('el último miembro: borra el grupo con sus Reminder y AiConversation y avisa con onGroupDeleted', async () => {
      const { group, users } = await createGroupWithMembers(1);
      const last = users[0]!;
      await seedGroupScopedRows(group.id, last.id);
      const deleted: string[] = [];
      t.app.get(GroupLifecycleHooks).register({ name: 'test', onGroupDeleted: (id) => void deleted.push(id) });

      const agent = await loginAs(last, t.server);
      await agent.post(leaveUrl(group.id)).set('Origin', ORIGIN).expect(204);

      expect(await prisma.group.count({ where: { id: group.id } })).toBe(0);
      expect(await prisma.reminder.count({ where: { groupId: group.id } })).toBe(0);
      expect(await prisma.aiConversation.count({ where: { groupId: group.id } })).toBe(0);
      expect(await prisma.activityLog.count({ where: { groupId: group.id } })).toBe(0);
      expect(realtime.ofEvent('group.member.left')).toEqual([expect.objectContaining({ data: { userId: last.id } })]);
      expect(realtime.ofEvent('activity.created')).toHaveLength(0);
      expect(deleted).toContain(group.id);
    });

    it('ejecuta los MemberRemovedHooks dentro de la transacción: si uno falla, no se borra nada', async () => {
      const { group, users } = await createGroupWithMembers(2);
      const hooks = t.app.get(MemberRemovedHooks);
      const seen: string[] = [];
      hooks.register({
        name: 'test',
        onMemberRemoved: async (_tx, ctx) => {
          seen.push(`${ctx.groupId}:${ctx.userId}`);
          if (ctx.userId === users[1]!.id) throw new Error('fallo del módulo');
        },
      });

      const agent = await loginAs(users[1]!, t.server);
      await agent.post(leaveUrl(group.id)).set('Origin', ORIGIN).expect(500);
      expect(seen).toEqual([`${group.id}:${users[1]!.id}`]);
      expect(await prisma.groupMember.count({ where: { groupId: group.id } })).toBe(2);
      expect(realtime.ofEvent('group.member.left')).toHaveLength(0);
    });

    it('usuario de otro grupo → 404; sin sesión → 401', async () => {
      const { group } = await createGroupWithMembers(1);
      const stranger = await createUser();
      const agent = await loginAs(stranger, t.server);
      await agent.post(leaveUrl(group.id)).set('Origin', ORIGIN).expect(404);
      await request(t.server).post(leaveUrl(group.id)).set('Origin', ORIGIN).expect(401);
    });
  });

  describe('DELETE /groups/:g/members/:userId', () => {
    it('expulsa a otro → 204, "expulsó a {nombre} del hogar" y el expulsado recibe 404 al instante', async () => {
      const { group, users } = await createGroupWithMembers(3, { members: [{ name: 'Ana' }, { name: 'Luis' }, { name: 'Leo' }] });
      const [ana, luis] = [users[0]!, users[1]!];
      const luisAgent = await loginAs(luis, t.server);
      await luisAgent.get(`/api/v1/groups/${group.id}`).expect(200); // la caché del guard ya lo tiene como miembro

      const anaAgent = await loginAs(ana, t.server);
      await anaAgent.delete(memberUrl(group.id, luis.id)).set('Origin', ORIGIN).expect(204);

      expect(await prisma.groupMember.count({ where: { groupId: group.id, userId: luis.id } })).toBe(0);
      const activity = await prisma.activityLog.findFirstOrThrow({ where: { groupId: group.id, action: 'removed' } });
      expect(activity).toMatchObject({ actorId: ana.id, summary: 'expulsó a Luis del hogar', metadata: { userId: luis.id } });
      expect(realtime.ofEvent('group.member.left')).toEqual([expect.objectContaining({ actorId: ana.id, data: { userId: luis.id } })]);

      await luisAgent.get(`/api/v1/groups/${group.id}`).expect(404);
    });

    it('expulsarse a uno mismo → 422 con el mensaje de la spec', async () => {
      const { group, users } = await createGroupWithMembers(2);
      const agent = await loginAs(users[0]!, t.server);
      const res = await agent.delete(memberUrl(group.id, users[0]!.id)).set('Origin', ORIGIN);
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR', detail: 'Para salir del hogar, usa «Salir del hogar»' });
    });

    it('userId que no es miembro → 404; dos expulsiones mutuas: la segunda → 404', async () => {
      const { group, users } = await createGroupWithMembers(3);
      const outsider = await createUser();
      const a = await loginAs(users[0]!, t.server);
      const b = await loginAs(users[1]!, t.server);

      await a.delete(memberUrl(group.id, outsider.id)).set('Origin', ORIGIN).expect(404);
      await a.delete(memberUrl(group.id, users[1]!.id)).set('Origin', ORIGIN).expect(204);
      await b.delete(memberUrl(group.id, users[0]!.id)).set('Origin', ORIGIN).expect(404);
    });

    it('usuario de otro grupo → 404', async () => {
      const { group, users } = await createGroupWithMembers(2);
      const stranger = await createUser();
      const agent = await loginAs(stranger, t.server);
      await agent.delete(memberUrl(group.id, users[1]!.id)).set('Origin', ORIGIN).expect(404);
    });
  });
});

describe('Salir y expulsar con sockets reales (HOG-106)', () => {
  let t: TestApp;
  let baseUrl: string;
  let gateway: RealtimeGateway;
  const opened: ClientSocket[] = [];

  beforeAll(async () => {
    t = await createTestApp();
    await t.app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(t.server.address() as { port: number }).port}`;
    gateway = t.app.get(RealtimeGateway);
  });

  afterEach(() => {
    for (const s of opened.splice(0)) s.disconnect();
  });

  afterAll(async () => {
    await t.close();
  });

  async function connectAs(cookie: string): Promise<ClientSocket> {
    const socket = connect(baseUrl, { path: '/realtime', transports: ['websocket'], extraHeaders: { Cookie: cookie, Origin: ORIGIN }, reconnection: false, forceNew: true });
    opened.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return socket;
  }

  it('el expulsado recibe group.member.left y después sale de la sala: no recibe más eventos del grupo', async () => {
    const { group, users } = await createGroupWithMembers(2);
    const [ana, luis] = [users[0]!, users[1]!];
    const socket = await connectAs(await sessionCookieFor(luis, t.server));
    const received: RealtimeEnvelope[] = [];
    socket.on(REALTIME_CHANNEL, (e: RealtimeEnvelope) => received.push(e));

    const anaAgent = await loginAs(ana, t.server);
    await anaAgent.delete(memberUrl(group.id, luis.id)).set('Origin', ORIGIN).expect(204);
    await new Promise((r) => setTimeout(r, 150));
    expect(received.map((e) => e.event)).toContain('group.member.left');

    const luisSockets = await gateway.server.in(userRoom(luis.id)).fetchSockets();
    expect(luisSockets.every((s) => !s.rooms.has(groupRoom(group.id)))).toBe(true);

    received.length = 0;
    await anaAgent.patch(`/api/v1/groups/${group.id}`).set('Origin', ORIGIN).send({ name: 'Casa nueva' }).expect(200);
    await new Promise((r) => setTimeout(r, 150));
    expect(received).toEqual([]);
  });
});
