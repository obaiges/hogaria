import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';


import { RealtimeRooms } from '../../src/realtime/realtime-rooms.service.js';
import { RealtimeGateway } from '../../src/realtime/realtime.gateway.js';
import { groupRoom, userRoom } from '../../src/realtime/rooms.js';
import { createGroupWithMembers, createUser, sessionCookieFor } from '../factories/index.js';
import { createTestApp, type TestApp } from '../utils/create-test-app.js';
import { getTestPrisma } from '../utils/prisma.js';

import type { RealtimeEnvelope } from '@hogaria/shared';
import type { User } from '@prisma/client';

const prisma = getTestPrisma();
const ORIGIN = 'https://hogaria.test'; // APP_URL de test/setup.ts

describe('RealtimeGateway (HOG-150)', () => {
  let t: TestApp;
  let baseUrl: string;
  let gateway: RealtimeGateway;
  let rooms: RealtimeRooms;
  const opened: ClientSocket[] = [];

  beforeAll(async () => {
    t = await createTestApp();
    await t.app.listen(0, '127.0.0.1');
    const address = t.server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
    gateway = t.app.get(RealtimeGateway);
    rooms = t.app.get(RealtimeRooms);
  });

  afterEach(() => {
    for (const s of opened.splice(0)) s.disconnect();
  });

  afterAll(async () => {
    await t.close();
  });

  function open(headers: Record<string, string>): ClientSocket {
    const socket = connect(baseUrl, {
      path: '/realtime',
      transports: ['websocket'],
      extraHeaders: headers,
      reconnection: false,
      forceNew: true,
    });
    opened.push(socket);
    return socket;
  }

  /** Conecta y espera a `connect`; falla si llega `connect_error`. */
  async function connectAs(cookie: string): Promise<ClientSocket> {
    const socket = open({ Cookie: cookie, Origin: ORIGIN });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return socket;
  }

  /** Espera el `connect_error` y devuelve `{ message, code }`. */
  async function connectError(headers: Record<string, string>): Promise<{ message: string; code: unknown }> {
    const socket = open(headers);
    return new Promise((resolve, reject) => {
      socket.once('connect', () => reject(new Error('Se conectó y no debía')));
      socket.once('connect_error', (err: Error & { data?: { code?: unknown } }) => resolve({ message: err.message, code: err.data?.code }));
    });
  }

  /** Salas de servidor de los sockets de `user` (sin la sala propia del id de socket). */
  async function roomsOf(user: User): Promise<string[][]> {
    const sockets = await gateway.server.in(userRoom(user.id)).fetchSockets();
    return sockets.map((s) => [...s.rooms].filter((r) => r !== s.id).sort());
  }

  /** Recoge lo que llega por `evt` durante un instante. */
  async function received(socket: ClientSocket, act: () => void, ms = 150): Promise<unknown[]> {
    const got: unknown[] = [];
    const listener = (payload: unknown) => got.push(payload);
    socket.on('evt', listener);
    act();
    await new Promise((r) => setTimeout(r, ms));
    socket.off('evt', listener);
    return got;
  }

  it('sin cookie → connect_error UNAUTHENTICATED', async () => {
    expect(await connectError({ Origin: ORIGIN })).toEqual({ message: 'UNAUTHENTICATED', code: 'UNAUTHENTICATED' });
  });

  it('cookie falsa → UNAUTHENTICATED', async () => {
    const res = await connectError({ Origin: ORIGIN, Cookie: 'hogaria.session_token=falso.firma' });
    expect(res.code).toBe('UNAUTHENTICATED');
  });

  it('Origin no permitido o ausente → UNAUTHENTICATED aunque la sesión sea válida', async () => {
    const cookie = await sessionCookieFor(await createUser(), t.server);
    expect((await connectError({ Cookie: cookie, Origin: 'https://evil.example' })).code).toBe('UNAUTHENTICATED');
    expect((await connectError({ Cookie: cookie })).code).toBe('UNAUTHENTICATED');
  });

  it('usuario bloqueado → connect_error ACCOUNT_BLOCKED', async () => {
    const user = await createUser();
    const cookie = await sessionCookieFor(user, t.server);
    await prisma.user.update({ where: { id: user.id }, data: { blockedAt: new Date() } });
    expect(await connectError({ Cookie: cookie, Origin: ORIGIN })).toEqual({ message: 'ACCOUNT_BLOCKED', code: 'ACCOUNT_BLOCKED' });
  });

  it('un usuario con 2 grupos entra en user:<id> y en group:<id> de cada uno', async () => {
    const a = await createGroupWithMembers(1);
    const user = a.users[0]!;
    const b = await createGroupWithMembers(1);
    await prisma.groupMember.create({ data: { groupId: b.group.id, userId: user.id, laneColor: 'SEA' } });
    const ajeno = await createGroupWithMembers(1);

    await connectAs(await sessionCookieFor(user, t.server));

    const [socketRooms] = await roomsOf(user);
    expect(socketRooms).toEqual([groupRoom(a.group.id), groupRoom(b.group.id), userRoom(user.id)].sort());
    expect(socketRooms).not.toContain(groupRoom(ajeno.group.id));
  });

  it('socket.data guarda userId y sessionId', async () => {
    const user = await createUser();
    await connectAs(await sessionCookieFor(user, t.server));
    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    const [socket] = await gateway.server.in(userRoom(user.id)).fetchSockets();
    expect(socket?.data).toEqual({ userId: user.id, sessionId: session.id });
  });

  it('joinGroup y leaveGroup cambian lo que recibe el usuario (en todos sus sockets)', async () => {
    const { group } = await createGroupWithMembers(1);
    const user = await createUser();
    const cookie = await sessionCookieFor(user, t.server);
    const s1 = await connectAs(cookie);
    const s2 = await connectAs(cookie);
    const envelope: RealtimeEnvelope = { event: 'group.updated', groupId: group.id, actorId: null, clientMutationId: null, at: new Date().toISOString(), data: {} };
    const emit = () => gateway.server.to(groupRoom(group.id)).emit('evt', envelope);

    expect(await received(s1, emit)).toEqual([]);

    rooms.joinGroup(user.id, group.id);
    const [got1, got2] = await Promise.all([received(s1, emit), received(s2, () => undefined)]);
    expect(got1).toEqual([envelope]);
    expect(got2).toEqual([envelope]);

    rooms.leaveGroup(user.id, group.id);
    expect(await received(s1, emit)).toEqual([]);
    expect(await roomsOf(user)).toEqual([[userRoom(user.id)], [userRoom(user.id)]]);
  });

  it('disconnectSessions solo desconecta la sesión indicada', async () => {
    const user = await createUser();
    const s1 = await connectAs(await sessionCookieFor(user, t.server));
    const s2 = await connectAs(await sessionCookieFor(user, t.server));
    const otherUser = await connectAs(await sessionCookieFor(await createUser(), t.server));
    const sessions = await prisma.session.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
    expect(sessions).toHaveLength(2);

    const disconnected = new Promise<string>((resolve) => s1.once('disconnect', resolve));
    expect(await gateway.disconnectSessions(user.id, { sessionIds: [sessions[0]!.id] })).toBe(1);
    expect(await disconnected).toBe('io server disconnect');
    expect(s2.connected).toBe(true);
    expect(otherUser.connected).toBe(true);
  });

  it('disconnectSessions con exceptSessionId desconecta las demás; sin opciones, todas', async () => {
    const user = await createUser();
    const s1 = await connectAs(await sessionCookieFor(user, t.server));
    const s2 = await connectAs(await sessionCookieFor(user, t.server));
    const s3 = await connectAs(await sessionCookieFor(user, t.server));
    const sessions = await prisma.session.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });

    expect(await gateway.disconnectSessions(user.id, { exceptSessionId: sessions[2]!.id })).toBe(2);
    await new Promise((r) => setTimeout(r, 50));
    expect([s1.connected, s2.connected, s3.connected]).toEqual([false, false, true]);

    expect(await gateway.disconnectSessions(user.id)).toBe(1);
    await new Promise((r) => setTimeout(r, 50));
    expect(s3.connected).toBe(false);
  });

  it('lo que emite el cliente no tiene efecto (socket solo de bajada)', async () => {
    const { group } = await createGroupWithMembers(1);
    const user = await createUser();
    const socket = await connectAs(await sessionCookieFor(user, t.server));

    socket.emit('join', groupRoom(group.id));
    socket.emit('evt', { event: 'shopping.item.created' });
    await new Promise((r) => setTimeout(r, 100));

    expect(socket.connected).toBe(true);
    expect(await roomsOf(user)).toEqual([[userRoom(user.id)]]);
  });
});
