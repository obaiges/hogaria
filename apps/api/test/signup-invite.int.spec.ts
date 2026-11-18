import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AUTH, type Auth } from '../src/auth/auth.js';
import { createInviteDatabaseHooks, SignupInviteConsumerRef } from '../src/auth/invite-hooks.js';
import { AuthRequestLimiter } from '../src/auth/rate-limit/auth-request-limiter.js';
import { MembershipCache } from '../src/common/cache/membership-cache.js';
import { RealtimePublisher } from '../src/realtime/realtime.publisher.js';
import { createGroupWithMembers, createInvite } from './factories/index.js';
import { useFakeRealtimePublisher, type FakeRealtimePublisher } from './fakes/index.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';

import type { SecurityEventType } from '@prisma/client';

const prisma = getTestPrisma();
const ORIGIN = 'https://hogaria.test';
const PASSWORD = 'contraseña-muy-larga-1';

let seq = 0;
const newUserBody = () => {
  seq += 1;
  return { name: `Nueva ${seq}`, email: `nueva${seq}@demo.local`, username: `nueva${seq}`, password: PASSWORD };
};

function setCookies(res: request.Response): string[] {
  return (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
}

describe('registro con invitación (HOG-052)', () => {
  let t: TestApp;
  let realtime: FakeRealtimePublisher;

  beforeAll(async () => {
    t = await createTestApp({ configure: useFakeRealtimePublisher });
    realtime = t.app.get(RealtimePublisher) as FakeRealtimePublisher;
  });

  beforeEach(() => {
    realtime.clear();
    t.app.get(MembershipCache).clear();
    t.app.get(AuthRequestLimiter).clear(); // 5 registros por hora y por IP (RN-01-27)
  });

  afterAll(async () => {
    await t.close();
  });

  const signUp = (body: object, cookie?: string) => {
    const req = request(t.server).post('/api/auth/sign-up/email').set('Origin', ORIGIN).set('User-Agent', 'vitest');
    return (cookie ? req.set('Cookie', cookie) : req).send(body);
  };

  const events = (type: SecurityEventType) => prisma.securityEvent.findMany({ where: { type } });

  it('sin cookie → 403 INVITE_REQUIRED, sin usuario y con SecurityEvent', async () => {
    const body = newUserBody();
    const res = await signUp(body);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'INVITE_REQUIRED', message: 'Necesitas una invitación para registrarte' });
    expect(await prisma.user.count({ where: { email: body.email } })).toBe(0);
    const [event] = await events('SIGNUP_REJECTED_NO_INVITE');
    expect(event).toMatchObject({ identifier: body.email, userAgent: 'vitest', userId: null });
    expect(event?.ipAddress).toBeTruthy();
  });

  it('con cookie válida → usuario unido al grupo, invitación usada, eventos, SecurityEvent y cookie borrada', async () => {
    const { group } = await createGroupWithMembers(1);
    const { invite, token } = await createInvite(group.id);
    const body = newUserBody();

    const res = await signUp(body, `hogaria_invite=${token}`);
    expect(res.status).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: body.email } });
    const member = await prisma.groupMember.findUniqueOrThrow({ where: { groupId_userId: { groupId: group.id, userId: user.id } } });
    expect(member.laneColor).toBe('SEA');
    expect(await prisma.groupInvite.findUniqueOrThrow({ where: { id: invite.id } })).toMatchObject({ usedById: user.id, usedAt: expect.any(Date) });

    expect(realtime.published.map((p) => p.envelope.event)).toEqual(['group.member.joined', 'invite.used', 'activity.created']);
    expect(realtime.ofEvent('group.member.joined')[0]).toMatchObject({ groupId: group.id, actorId: user.id, data: { userId: user.id, name: body.name } });
    expect(realtime.ofEvent('activity.created')[0]?.data).toMatchObject({ actorName: body.name, summary: 'se unió al hogar' });

    expect(await events('SIGNUP_WITH_INVITE')).toEqual([expect.objectContaining({ userId: user.id })]);
    const cleared = setCookies(res).find((c) => c.startsWith('hogaria_invite='));
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(/Max-Age=0/);
    expect(cleared).toMatch(/Path=\/api\/auth/);
  });

  it.each(['used', 'revoked', 'expired'] as const)('cookie de una invitación %s → 403 sin usuario', async (status) => {
    const { group } = await createGroupWithMembers(1);
    const { token } = await createInvite(group.id, { status });
    const body = newUserBody();
    const res = await signUp(body, `hogaria_invite=${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INVITE_REQUIRED');
    expect(await prisma.user.count({ where: { email: body.email } })).toBe(0);
  });

  it('cookie con un token inventado → 403', async () => {
    const res = await signUp(newUserBody(), 'hogaria_invite=esto-no-es-una-invitacion');
    expect(res.status).toBe(403);
  });

  it('flujo completo: GET /invites/:token pone la cookie y el registro la usa', async () => {
    const { group } = await createGroupWithMembers(1);
    const { token } = await createInvite(group.id);
    const agent = request.agent(t.server);
    const view = await agent.get(`/api/v1/invites/${token}`).expect(200);
    expect(setCookies(view).some((c) => c.startsWith('hogaria_invite='))).toBe(true);

    const body = newUserBody();
    await agent.post('/api/auth/sign-up/email').set('Origin', ORIGIN).send(body).expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: body.email } });
    expect(await prisma.groupMember.count({ where: { groupId: group.id, userId: user.id } })).toBe(1);
  });

  it('carrera: si la invitación se usa entre el before y el after, el usuario se crea sin grupo (RN-01-05)', async () => {
    const { group } = await createGroupWithMembers(1);
    const { invite, token } = await createInvite(group.id);
    const ref = new SignupInviteConsumerRef();
    // Simula que otra persona la consume justo antes del after.
    ref.set({
      consumeForNewUser: async () => {
        await prisma.groupInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
        throw new Error('INVITE_INVALID');
      },
    });
    const recorded: SecurityEventType[] = [];
    const hooks = createInviteDatabaseHooks({
      prisma,
      securityEvents: { record: async (type) => void recorded.push(type) },
      consumer: ref,
      requireInvite: true,
      secureCookies: false,
    });
    const cleared: string[] = [];
    const ctx = { headers: new Headers({ cookie: `hogaria_invite=${token}` }), setCookie: (name: string) => void cleared.push(name) };

    await expect(hooks.create.before({ email: 'x@demo.local' }, ctx)).resolves.toBeUndefined();
    await expect(hooks.create.after({ id: 'user-1' }, ctx)).resolves.toBeUndefined();
    expect(recorded).toEqual([]); // ni SIGNUP_WITH_INVITE
    expect(cleared).toEqual(['hogaria_invite']);
  });

  it('con SIGNUP_REQUIRES_INVITE=false no se exige invitación, pero una cookie válida se consume', async () => {
    const consumed: string[] = [];
    const ref = new SignupInviteConsumerRef();
    ref.set({ consumeForNewUser: async (token) => void consumed.push(token) });
    const hooks = createInviteDatabaseHooks({
      prisma,
      securityEvents: { record: async () => {} },
      consumer: ref,
      requireInvite: false,
      secureCookies: false,
    });

    await expect(hooks.create.before({ email: 'libre@demo.local' }, { headers: new Headers() })).resolves.toBeUndefined();

    const { group } = await createGroupWithMembers(1);
    const { token } = await createInvite(group.id);
    const ctx = { headers: new Headers({ cookie: `otra=1; hogaria_invite=${token}` }), setCookie: () => {} };
    await hooks.create.before({ email: 'libre2@demo.local' }, ctx);
    await hooks.create.after({ id: 'user-2' }, ctx);
    expect(consumed).toEqual([token]);
  });

  it('las creaciones internas sin petición (CLI create-owner) no exigen invitación', async () => {
    const hooks = createInviteDatabaseHooks({
      prisma,
      securityEvents: { record: async () => {} },
      consumer: new SignupInviteConsumerRef(),
      requireInvite: true,
      secureCookies: false,
    });
    await expect(hooks.create.before({ email: 'owner@demo.local' }, null)).resolves.toBeUndefined();
    await expect(hooks.create.after({ id: 'owner' }, null)).resolves.toBeUndefined();
  });

  it('el alta por Google sin invitación también lanza INVITE_REQUIRED (Better Auth redirige a /entrar?error=INVITE_REQUIRED)', async () => {
    // El hook es el mismo para cualquier creación de usuario. El proveedor de Google se
    // configura en HOG-051; aquí se comprueba el error que Better Auth convierte en
    // `errorURL?error=<code>` en el callback de OAuth.
    const hooks = createInviteDatabaseHooks({
      prisma,
      securityEvents: { record: async () => {} },
      consumer: new SignupInviteConsumerRef(),
      requireInvite: true,
      secureCookies: false,
    });
    const error = await hooks.create.before({ email: 'google@demo.local' }, { headers: new Headers() }).catch((e: unknown) => e);
    expect(error).toMatchObject({ statusCode: 403, body: { code: 'INVITE_REQUIRED' } });
    const auth = t.app.get<Auth>(AUTH);
    expect(auth.options.onAPIError?.errorURL).toBe(`${ORIGIN}/entrar`);
  });
});
