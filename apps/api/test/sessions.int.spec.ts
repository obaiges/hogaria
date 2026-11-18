import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { RealtimeGateway } from '../src/realtime/realtime.gateway.js';
import { RealtimePublisher } from '../src/realtime/realtime.publisher.js';
import { createUser, loginAs, type SessionAgent } from './factories/index.js';
import { useFakeRealtimePublisher, type FakeRealtimePublisher } from './fakes/index.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';

import type { User } from '@prisma/client';

const prisma = getTestPrisma();
const ORIGIN = 'https://hogaria.test';
const PASSWORD = 'contraseña-de-prueba';

describe('Gestión de sesiones (HOG-056, RN-01-22/23)', () => {
  let t: TestApp;
  let realtime: FakeRealtimePublisher;
  let disconnect: MockInstance<RealtimeGateway['disconnectSessions']>;

  beforeAll(async () => {
    t = await createTestApp({ configure: useFakeRealtimePublisher });
    realtime = t.app.get(RealtimePublisher) as FakeRealtimePublisher;
    disconnect = vi.spyOn(t.app.get(RealtimeGateway), 'disconnectSessions').mockResolvedValue(0);
  });

  beforeEach(() => {
    realtime.clear();
    disconnect.mockClear();
  });

  afterAll(async () => {
    await t.close();
  });

  const post = (agent: SessionAgent, path: string, body: object = {}) => agent.post(`/api/auth${path}`).set('Origin', ORIGIN).send(body);
  const sessionsOf = (user: User) => prisma.session.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
  const revokedEvents = (user: User) => prisma.securityEvent.count({ where: { type: 'SESSION_REVOKED', userId: user.id } });

  /** Tres dispositivos del mismo usuario: [actual, otro, otro]. */
  async function threeDevices() {
    const user = await createUser({ password: PASSWORD });
    const agents = [await loginAs(user, t.server), await loginAs(user, t.server), await loginAs(user, t.server)];
    const sessions = await sessionsOf(user);
    expect(sessions).toHaveLength(3);
    realtime.clear();
    return { user, agents, sessions };
  }

  it('list-sessions devuelve las sesiones del usuario', async () => {
    const { agents } = await threeDevices();
    const res = await agents[0]!.get('/api/auth/list-sessions').expect(200);
    expect(res.body).toHaveLength(3);
  });

  it('revocar otra sesión: su cookie da 401, session.revoked a user:<id>, SESSION_REVOKED y sockets de esa sesión', async () => {
    const { user, agents, sessions } = await threeDevices();
    const [current, other] = agents;

    await post(current!, '/revoke-session', { token: sessions[1]!.token }).expect(200);

    await other!.get('/api/v1/me').expect(401);
    await current!.get('/api/v1/me').expect(200);
    await agents[2]!.get('/api/v1/me').expect(200);

    const published = realtime.published.filter((p) => p.envelope.event === 'session.revoked');
    expect(published).toEqual([expect.objectContaining({ room: `user:${user.id}`, envelope: expect.objectContaining({ groupId: null, data: {} }) })]);
    expect(await revokedEvents(user)).toBe(1);
    expect(disconnect).toHaveBeenCalledWith(user.id, { sessionIds: [sessions[1]!.id] });
  });

  it('revocar una sesión de otro usuario no hace nada', async () => {
    const { user, sessions } = await threeDevices();
    const intruder = await loginAs(await createUser(), t.server);
    realtime.clear();

    await post(intruder, '/revoke-session', { token: sessions[0]!.token });
    expect(await sessionsOf(user)).toHaveLength(3);
    expect(realtime.ofEvent('session.revoked')).toHaveLength(0);
    expect(await revokedEvents(user)).toBe(0);
  });

  it('"cerrar las demás" conserva la actual y revoca el resto con un solo evento', async () => {
    const { user, agents, sessions } = await threeDevices();
    await post(agents[0]!, '/revoke-other-sessions').expect(200);

    await agents[0]!.get('/api/v1/me').expect(200);
    await agents[1]!.get('/api/v1/me').expect(401);
    await agents[2]!.get('/api/v1/me').expect(401);
    expect((await sessionsOf(user)).map((s) => s.id)).toEqual([sessions[0]!.id]);

    expect(realtime.ofEvent('session.revoked')).toHaveLength(1);
    expect(await revokedEvents(user)).toBe(1);
    expect(disconnect).toHaveBeenCalledWith(user.id, { sessionIds: expect.arrayContaining([sessions[1]!.id, sessions[2]!.id]) as string[] });
    expect(disconnect.mock.calls[0]![1]!.sessionIds).not.toContain(sessions[0]!.id);
  });

  it('"cerrar las demás" con una sola sesión no publica ni registra nada', async () => {
    const user = await createUser({ password: PASSWORD });
    const agent = await loginAs(user, t.server);
    realtime.clear();
    await post(agent, '/revoke-other-sessions').expect(200);
    expect(realtime.ofEvent('session.revoked')).toHaveLength(0);
    expect(await revokedEvents(user)).toBe(0);
  });

  it('revoke-sessions cierra todas, incluida la actual', async () => {
    const { user, agents } = await threeDevices();
    await post(agents[0]!, '/revoke-sessions').expect(200);
    expect(await sessionsOf(user)).toHaveLength(0);
    expect(realtime.ofEvent('session.revoked')).toHaveLength(1);
    expect(await revokedEvents(user)).toBe(1);
  });

  it('cambiar la contraseña con revokeOtherSessions revoca las demás y avisa', async () => {
    const { user, agents } = await threeDevices();
    await post(agents[0]!, '/change-password', { currentPassword: PASSWORD, newPassword: 'otra-contraseña-segura-5', revokeOtherSessions: true }).expect(200);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
    expect(realtime.ofEvent('session.revoked')).toHaveLength(1);
    expect(await revokedEvents(user)).toBe(1);
  });

  it('cerrar sesión: LOGOUT, sin session.revoked ni SESSION_REVOKED', async () => {
    const { user, agents } = await threeDevices();
    await post(agents[0]!, '/sign-out').expect(200);
    await agents[0]!.get('/api/v1/me').expect(401);
    expect(await sessionsOf(user)).toHaveLength(2);
    expect(realtime.ofEvent('session.revoked')).toHaveLength(0);
    expect(await revokedEvents(user)).toBe(0);
    expect(await prisma.securityEvent.count({ where: { type: 'LOGOUT', userId: user.id } })).toBe(1);
    expect(disconnect).not.toHaveBeenCalled();
  });
});
