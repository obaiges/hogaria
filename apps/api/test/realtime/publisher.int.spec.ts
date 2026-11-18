import { Controller, HttpCode, Module, Post } from '@nestjs/common';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { REALTIME_CHANNEL, type RealtimeEnvelope } from '@hogaria/shared';

import { CurrentUser } from '../../src/common/auth/decorators.js';
import { RealtimePublisher } from '../../src/realtime/realtime.publisher.js';
import { createGroupWithMembers, loginAs, sessionCookieFor } from '../factories/index.js';
import { FakeRealtimePublisher, useFakeRealtimePublisher } from '../fakes/index.js';
import { createTestApp, type TestApp } from '../utils/create-test-app.js';

import type { AuthUser } from '../../src/common/auth/auth-user.js';

const ORIGIN = 'https://hogaria.test';
const MUTATION = '0193a0b2-0000-7000-8000-0000000000ff';

@Controller('publish-test')
class PublishTestController {
  constructor(private readonly realtime: RealtimePublisher) {}

  @Post()
  @HttpCode(204)
  publish(@CurrentUser() user: AuthUser): void {
    this.realtime.publishToUser(user.id, 'session.revoked', {});
  }
}

@Module({ controllers: [PublishTestController] })
class PublishTestModule {}

describe('RealtimePublisher de extremo a extremo (HOG-151)', () => {
  let t: TestApp;
  let baseUrl: string;
  const opened: ClientSocket[] = [];

  beforeAll(async () => {
    t = await createTestApp({ imports: [PublishTestModule] });
    await t.app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(t.server.address() as { port: number }).port}`;
  });

  afterEach(() => {
    for (const s of opened.splice(0)) s.disconnect();
  });

  afterAll(async () => {
    await t.close();
  });

  it('una petición REST con X-Client-Mutation-Id llega al socket con ese id y el actor', async () => {
    const { users } = await createGroupWithMembers(1);
    const user = users[0]!;
    const socket = connect(baseUrl, {
      path: '/realtime',
      transports: ['websocket'],
      extraHeaders: { Cookie: await sessionCookieFor(user, t.server), Origin: ORIGIN },
      reconnection: false,
      forceNew: true,
    });
    opened.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });

    const received = new Promise<RealtimeEnvelope>((resolve) => socket.once(REALTIME_CHANNEL, resolve));
    const agent = await loginAs(user, t.server);
    await agent.post('/api/v1/publish-test').set('Origin', ORIGIN).set('X-Client-Mutation-Id', MUTATION).expect(204);

    const envelope = await received;
    expect(envelope).toMatchObject({
      event: 'session.revoked',
      groupId: null,
      actorId: user.id,
      clientMutationId: MUTATION,
      data: {},
    });
    expect(Date.parse(envelope.at)).not.toBeNaN();
  });
});

describe('FakeRealtimePublisher (HOG-151)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ imports: [PublishTestModule], configure: useFakeRealtimePublisher });
  });

  afterAll(async () => {
    await t.close();
  });

  it('guarda los sobres con el mismo contrato que el publisher real', async () => {
    const realtime = t.app.get(RealtimePublisher);
    expect(realtime).toBeInstanceOf(FakeRealtimePublisher);
    const fake = realtime as FakeRealtimePublisher;

    const { users } = await createGroupWithMembers(1);
    const agent = await loginAs(users[0]!, t.server);
    await agent.post('/api/v1/publish-test').set('Origin', ORIGIN).set('X-Client-Mutation-Id', MUTATION).expect(204);

    expect(fake.published).toEqual([
      {
        room: `user:${users[0]!.id}`,
        envelope: expect.objectContaining({ event: 'session.revoked', groupId: null, actorId: users[0]!.id, clientMutationId: MUTATION }),
      },
    ]);
    expect(fake.ofEvent('session.revoked')).toHaveLength(1);
    fake.clear();
    expect(fake.published).toEqual([]);
  });
});
