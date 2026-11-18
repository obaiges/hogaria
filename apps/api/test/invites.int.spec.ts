import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { acceptInviteResultDto, createdGroupInviteDto, groupInviteDto, MAX_GROUP_MEMBERS, publicInviteDto } from '@hogaria/shared';

import { MembershipCache } from '../src/common/cache/membership-cache.js';
import { uuidv7 } from '../src/common/ids/uuidv7.js';
import { RealtimePublisher } from '../src/realtime/realtime.publisher.js';
import { createGroupWithMembers, createInvite, createUser, hashInviteToken, loginAs } from './factories/index.js';
import { useFakeRealtimePublisher, type FakeRealtimePublisher } from './fakes/index.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';

const prisma = getTestPrisma();
const ORIGIN = 'https://hogaria.test';
const MUTATION = '0193a0b2-0000-7000-8000-0000000000ff';

describe('API de invitaciones (HOG-102)', () => {
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

  const post = (agent: Awaited<ReturnType<typeof loginAs>>, path: string) => agent.post(`/api/v1${path}`).set('Origin', ORIGIN);

  describe('POST /groups/:groupId/invites', () => {
    it('crea con token de 43 caracteres, guarda solo el hash, actividad e invite.created sin token', async () => {
      const { group, users } = await createGroupWithMembers(1, { members: [{ name: 'Ana' }] });
      const agent = await loginAs(users[0]!, t.server);

      const res = await post(agent, `/groups/${group.id}/invites`).set('X-Client-Mutation-Id', MUTATION).expect(201);
      const body = createdGroupInviteDto.parse(res.body);
      expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(body.url).toBe(`https://hogaria.test/invite/${body.token}`);
      expect(body.invite).toMatchObject({ groupId: group.id, status: 'ACTIVE', createdById: users[0]!.id, createdByName: 'Ana' });
      const ttl = Date.parse(body.invite.expiresAt) - Date.parse(body.invite.createdAt);
      expect(Math.round(ttl / 86_400_000)).toBe(10);

      const stored = await prisma.groupInvite.findUniqueOrThrow({ where: { id: body.invite.id } });
      expect(stored.tokenHash).toBe(hashInviteToken(body.token));
      expect(JSON.stringify(stored)).not.toContain(body.token);

      expect(await prisma.activityLog.findMany({ where: { groupId: group.id } })).toEqual([
        expect.objectContaining({ entityType: 'group_invite', entityId: body.invite.id, action: 'created', summary: 'creó una invitación' }),
      ]);
      const [created] = realtime.ofEvent('invite.created');
      expect(created).toMatchObject({ groupId: group.id, actorId: users[0]!.id, clientMutationId: MUTATION, data: body.invite });
      expect(JSON.stringify(realtime.published)).not.toContain(body.token);
    });

    it('la 21.ª invitación activa → 409 (las caducadas no cuentan)', async () => {
      const { group, users } = await createGroupWithMembers(1);
      for (let i = 0; i < 20; i++) await createInvite(group.id);
      await createInvite(group.id, { status: 'expired' });
      const agent = await loginAs(users[0]!, t.server);
      const res = await post(agent, `/groups/${group.id}/invites`).expect(409);
      expect(res.body).toMatchObject({ code: 'CONFLICT', detail: 'Hay demasiadas invitaciones pendientes. Revoca alguna' });
    });

    it('grupo lleno → 409', async () => {
      const { group, users } = await createGroupWithMembers(MAX_GROUP_MEMBERS);
      const agent = await loginAs(users[0]!, t.server);
      const res = await post(agent, `/groups/${group.id}/invites`).expect(409);
      expect(res.body.detail).toBe('Este hogar ya tiene el máximo de 20 miembros');
    });

    it('no miembro → 404; sin sesión → 401', async () => {
      const { group } = await createGroupWithMembers(1);
      const outsider = await loginAs(await createUser(), t.server);
      await post(outsider, `/groups/${group.id}/invites`).expect(404);
      await request(t.server).post(`/api/v1/groups/${group.id}/invites`).set('Origin', ORIGIN).expect(401);
    });
  });

  describe('GET /groups/:groupId/invites', () => {
    it('activas y no activas de los últimos 30 días, por createdAt desc, sin token', async () => {
      const { group, users } = await createGroupWithMembers(2, { members: [{ name: 'Ana' }, { name: 'Luis' }] });
      const old = await createInvite(group.id, { status: 'revoked' });
      await prisma.groupInvite.update({ where: { id: old.invite.id }, data: { createdAt: new Date(Date.now() - 31 * 86_400_000) } });
      const used = await createInvite(group.id, { status: 'used', createdById: users[0]!.id, usedById: users[1]!.id });
      const active = await createInvite(group.id, { createdById: users[0]!.id });

      const agent = await loginAs(users[0]!, t.server);
      const res = await agent.get(`/api/v1/groups/${group.id}/invites`).expect(200);
      const list = res.body.map((i: unknown) => groupInviteDto.parse(i));
      expect(list.map((i: { id: string; status: string }) => [i.id, i.status])).toEqual([
        [active.invite.id, 'ACTIVE'],
        [used.invite.id, 'USED'],
      ]);
      expect(list[1]).toMatchObject({ createdByName: 'Ana', usedByName: 'Luis' });
      expect(JSON.stringify(res.body)).not.toContain(active.token);
    });

    it('no miembro → 404', async () => {
      const { group } = await createGroupWithMembers(1);
      const outsider = await loginAs(await createUser(), t.server);
      await outsider.get(`/api/v1/groups/${group.id}/invites`).expect(404);
    });
  });

  describe('DELETE /groups/:groupId/invites/:inviteId', () => {
    it('revoca una activa → dto REVOKED, actividad e invite.revoked', async () => {
      const { group, users } = await createGroupWithMembers(1);
      const { invite, token } = await createInvite(group.id);
      const agent = await loginAs(users[0]!, t.server);

      const res = await agent.delete(`/api/v1/groups/${group.id}/invites/${invite.id}`).set('Origin', ORIGIN).expect(200);
      expect(groupInviteDto.parse(res.body)).toMatchObject({ id: invite.id, status: 'REVOKED' });
      expect(await prisma.activityLog.findMany({ where: { groupId: group.id } })).toEqual([
        expect.objectContaining({ action: 'revoked', summary: 'revocó una invitación', entityId: invite.id }),
      ]);
      expect(realtime.ofEvent('invite.revoked')[0]?.data).toEqual(res.body);
      await request(t.server).get(`/api/v1/invites/${token}`).expect(410);
    });

    it.each(['used', 'revoked', 'expired'] as const)('una %s → 409', async (status) => {
      const { group, users } = await createGroupWithMembers(1);
      const { invite } = await createInvite(group.id, { status });
      const agent = await loginAs(users[0]!, t.server);
      const res = await agent.delete(`/api/v1/groups/${group.id}/invites/${invite.id}`).set('Origin', ORIGIN).expect(409);
      expect(res.body.detail).toBe('Esta invitación ya no está activa');
    });

    it('invitación de otro grupo, inexistente o id inválido → 404; no miembro → 404', async () => {
      const { group, users } = await createGroupWithMembers(1);
      const other = await createGroupWithMembers(1);
      const { invite: foreign } = await createInvite(other.group.id);
      const agent = await loginAs(users[0]!, t.server);
      await agent.delete(`/api/v1/groups/${group.id}/invites/${foreign.id}`).set('Origin', ORIGIN).expect(404);
      await agent.delete(`/api/v1/groups/${group.id}/invites/${uuidv7()}`).set('Origin', ORIGIN).expect(404);
      await agent.delete(`/api/v1/groups/${group.id}/invites/no-uuid`).set('Origin', ORIGIN).expect(404);
      expect((await prisma.groupInvite.findUniqueOrThrow({ where: { id: foreign.id } })).revokedAt).toBeNull();

      const outsider = await loginAs(await createUser(), t.server);
      await outsider.delete(`/api/v1/groups/${other.group.id}/invites/${foreign.id}`).set('Origin', ORIGIN).expect(404);
    });
  });

  describe('GET /invites/:token (público)', () => {
    it('válida sin sesión → 200 y cookie hogaria_invite', async () => {
      const { group, users } = await createGroupWithMembers(1, { name: 'Casa', emoji: '🐶', members: [{ name: 'Ana' }] });
      const { invite, token } = await createInvite(group.id, { createdById: users[0]!.id });

      const res = await request(t.server).get(`/api/v1/invites/${token}`).expect(200);
      expect(publicInviteDto.parse(res.body)).toEqual({
        groupName: 'Casa',
        groupEmoji: '🐶',
        invitedByName: 'Ana',
        expiresAt: invite.expiresAt.toISOString(),
        alreadyMember: false,
        groupId: null,
      });
      const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('hogaria_invite='));
      expect(cookie).toBeDefined();
      expect(cookie).toContain(`hogaria_invite=${token}`);
      expect(cookie).toMatch(/Max-Age=3600/);
      expect(cookie).toMatch(/Path=\/api\/auth/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
      expect(cookie).not.toMatch(/Secure/); // solo en producción
    });

    it('válida con sesión de un no miembro → 200 sin cookie', async () => {
      const { group } = await createGroupWithMembers(1);
      const { token } = await createInvite(group.id);
      const agent = await loginAs(await createUser(), t.server);
      const res = await agent.get(`/api/v1/invites/${token}`).expect(200);
      expect(res.body).toMatchObject({ alreadyMember: false, groupId: null });
      expect(((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []).some((c) => c.startsWith('hogaria_invite='))).toBe(false);
    });

    it('con sesión de un miembro → alreadyMember con groupId, aunque la invitación no esté activa', async () => {
      const { group, users } = await createGroupWithMembers(1);
      const { token } = await createInvite(group.id, { status: 'used' });
      const agent = await loginAs(users[0]!, t.server);
      const res = await agent.get(`/api/v1/invites/${token}`).expect(200);
      expect(res.body).toMatchObject({ alreadyMember: true, groupId: group.id });
    });

    it.each(['used', 'revoked', 'expired'] as const)('%s → 410 INVITE_INVALID, igual que una inexistente', async (status) => {
      const { group } = await createGroupWithMembers(1);
      const { token } = await createInvite(group.id, { status });
      const res = await request(t.server).get(`/api/v1/invites/${token}`).expect(410);
      const missing = await request(t.server).get('/api/v1/invites/no-existe-este-token').expect(410);
      expect(res.body).toEqual(missing.body);
      expect(res.body.code).toBe('INVITE_INVALID');
      expect(res.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('POST /invites/:token/accept', () => {
    it('une al usuario: miembro con el siguiente color, invitación usada, actividad y eventos', async () => {
      const { group } = await createGroupWithMembers(2);
      const { invite, token } = await createInvite(group.id);
      const user = await createUser({ name: 'Nuevo' });
      const agent = await loginAs(user, t.server);
      await agent.get(`/api/v1/groups/${group.id}`).expect(404); // el guard cachea el "no miembro"

      const res = await post(agent, `/invites/${token}/accept`).set('X-Client-Mutation-Id', MUTATION).expect(200);
      expect(acceptInviteResultDto.parse(res.body)).toEqual({ groupId: group.id, alreadyMember: false });

      const member = await prisma.groupMember.findUniqueOrThrow({ where: { groupId_userId: { groupId: group.id, userId: user.id } } });
      expect(member.laneColor).toBe('SUN');
      expect(await prisma.groupInvite.findUniqueOrThrow({ where: { id: invite.id } })).toMatchObject({ usedById: user.id, usedAt: expect.any(Date) });
      expect(await prisma.activityLog.findMany({ where: { groupId: group.id } })).toEqual([
        expect.objectContaining({ actorId: user.id, entityType: 'group_member', entityId: member.id, action: 'joined', summary: 'se unió al hogar' }),
      ]);

      expect(realtime.published.map((p) => p.envelope.event)).toEqual(['group.member.joined', 'invite.used', 'activity.created']);
      expect(realtime.ofEvent('group.member.joined')[0]).toMatchObject({
        actorId: user.id,
        clientMutationId: MUTATION,
        data: { userId: user.id, name: 'Nuevo', laneColor: 'SUN' },
      });
      expect(realtime.ofEvent('invite.used')[0]?.data).toMatchObject({ id: invite.id, status: 'USED', usedByName: 'Nuevo' });
      expect(realtime.ofEvent('activity.created')[0]?.data).toMatchObject({ actorName: 'Nuevo' });

      await agent.get(`/api/v1/groups/${group.id}`).expect(200); // caché invalidada al momento
    });

    it('si ya es miembro → alreadyMember sin consumir la invitación', async () => {
      const { group, users } = await createGroupWithMembers(1);
      const { invite, token } = await createInvite(group.id);
      const agent = await loginAs(users[0]!, t.server);
      const res = await post(agent, `/invites/${token}/accept`).expect(200);
      expect(res.body).toEqual({ groupId: group.id, alreadyMember: true });
      expect((await prisma.groupInvite.findUniqueOrThrow({ where: { id: invite.id } })).usedAt).toBeNull();
      expect(realtime.published).toEqual([]);
    });

    it('grupo con 20 miembros → 409 sin consumir', async () => {
      const { group } = await createGroupWithMembers(MAX_GROUP_MEMBERS);
      const { invite, token } = await createInvite(group.id);
      const agent = await loginAs(await createUser(), t.server);
      await post(agent, `/invites/${token}/accept`).expect(409);
      expect((await prisma.groupInvite.findUniqueOrThrow({ where: { id: invite.id } })).usedAt).toBeNull();
    });

    it.each(['used', 'revoked', 'expired'] as const)('invitación %s → 410', async (status) => {
      const { group } = await createGroupWithMembers(1);
      const { token } = await createInvite(group.id, { status });
      const agent = await loginAs(await createUser(), t.server);
      await post(agent, `/invites/${token}/accept`).expect(410);
      await post(agent, '/invites/no-existe/accept').expect(410);
    });

    it('dos aceptaciones simultáneas de la misma invitación → una 200 y una 410', async () => {
      const { group } = await createGroupWithMembers(1);
      const { token } = await createInvite(group.id);
      const a = await loginAs(await createUser(), t.server);
      const b = await loginAs(await createUser(), t.server);

      const results = await Promise.all([post(a, `/invites/${token}/accept`), post(b, `/invites/${token}/accept`)]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 410]);
      expect(await prisma.groupMember.count({ where: { groupId: group.id } })).toBe(2);
    });

    it('sin sesión → 401', async () => {
      const { group } = await createGroupWithMembers(1);
      const { token } = await createInvite(group.id);
      await request(t.server).post(`/api/v1/invites/${token}/accept`).set('Origin', ORIGIN).expect(401);
    });
  });

  it('consumeForNewUser usa el mismo consumo (hook de registro)', async () => {
    const { InvitesService } = await import('../src/modules/groups/invites.service.js');
    const { group } = await createGroupWithMembers(1);
    const { token } = await createInvite(group.id);
    const user = await createUser({ name: 'Registro' });
    const result = await t.app.get(InvitesService).consumeForNewUser(token, user.id);
    expect(result).toEqual({ groupId: group.id, alreadyMember: false });
    expect(realtime.ofEvent('group.member.joined')[0]).toMatchObject({ actorId: user.id, clientMutationId: null });
    expect(realtime.ofEvent('activity.created')[0]).toMatchObject({ actorId: user.id, data: { actorName: 'Registro' } });
  });
});
