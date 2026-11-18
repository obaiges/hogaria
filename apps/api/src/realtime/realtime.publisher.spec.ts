import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { REALTIME_CHANNEL } from '@hogaria/shared';

import { parseClientMutationId, requestContext, type RequestContextStore } from '../common/context/request-context.js';
import { RealtimePublisher } from './realtime.publisher.js';

import type { PrismaService } from '../prisma/prisma.service.js';
import type { RealtimeGateway } from './realtime.gateway.js';
import type { ConfigService } from '@nestjs/config';

const USER = '0193a0b2-0000-7000-8000-000000000001';
const GROUP_A = '0193a0b2-0000-7000-8000-00000000000a';
const GROUP_B = '0193a0b2-0000-7000-8000-00000000000b';
const MUTATION = '0193a0b2-0000-7000-8000-0000000000ff';

function setup(nodeEnv = 'test') {
  const emits: Array<{ room: string; channel: string; envelope: unknown }> = [];
  const emitImpl = vi.fn((room: string, channel: string, envelope: unknown) => {
    emits.push({ room, channel, envelope });
  });
  const gateway = {
    server: { to: (room: string) => ({ emit: (channel: string, envelope: unknown) => emitImpl(room, channel, envelope) }) },
  } as unknown as RealtimeGateway;
  const findMany = vi.fn(async () => [{ groupId: GROUP_A }, { groupId: GROUP_B }]);
  const prisma = { groupMember: { findMany } } as unknown as PrismaService;
  const config = { get: (key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined) } as unknown as ConfigService;
  return { publisher: new RealtimePublisher(gateway, prisma, config), emits, emitImpl, findMany };
}

function inRequest<T>(store: Partial<RequestContextStore>, fn: () => T): T {
  return requestContext.run(
    { requestId: 'req', userId: null, userName: null, sessionId: null, clientMutationId: null, ...store },
    fn,
  );
}

describe('RealtimePublisher (HOG-151)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-18T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('publish: sobre completo en group:<id> por el canal evt, con actor y clientMutationId de la petición', () => {
    const { publisher, emits } = setup();
    inRequest({ userId: USER, clientMutationId: MUTATION }, () => publisher.publish(GROUP_A, 'session.revoked', {}));

    expect(emits).toEqual([
      {
        room: `group:${GROUP_A}`,
        channel: REALTIME_CHANNEL,
        envelope: {
          event: 'session.revoked',
          groupId: GROUP_A,
          actorId: USER,
          clientMutationId: MUTATION,
          at: '2026-11-18T10:00:00.000Z',
          data: {},
        },
      },
    ]);
  });

  it('X-Client-Mutation-Id inválido → clientMutationId null', () => {
    const { publisher, emits } = setup();
    const clientMutationId = parseClientMutationId('no-es-un-uuid');
    inRequest({ userId: USER, clientMutationId }, () => publisher.publish(GROUP_A, 'session.revoked', {}));
    expect(emits[0]?.envelope).toMatchObject({ actorId: USER, clientMutationId: null });
  });

  it('opts.actorId null fuerza un evento de sistema dentro de una petición', () => {
    const { publisher, emits } = setup();
    inRequest({ userId: USER }, () => publisher.publish(GROUP_A, 'session.revoked', {}, { actorId: null }));
    expect(emits[0]?.envelope).toMatchObject({ actorId: null });
  });

  it('fuera de una petición (cron) actorId y clientMutationId son null', () => {
    const { publisher, emits } = setup();
    publisher.publish(GROUP_A, 'session.revoked', {});
    expect(emits[0]?.envelope).toMatchObject({ actorId: null, clientMutationId: null });
  });

  it('publishToUser: sala user:<id> con groupId null', () => {
    const { publisher, emits } = setup();
    inRequest({ userId: USER }, () => publisher.publishToUser(USER, 'session.revoked', {}));
    expect(emits).toHaveLength(1);
    expect(emits[0]).toMatchObject({ room: `user:${USER}`, envelope: { event: 'session.revoked', groupId: null, actorId: USER } });
  });

  it('publishToUserGroups: un sobre por grupo, cada uno con su groupId y una sola consulta', async () => {
    const { publisher, emits, findMany } = setup();
    await publisher.publishToUserGroups(USER, 'session.revoked', {});
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(emits.map((e) => [e.room, (e.envelope as { groupId: string }).groupId])).toEqual([
      [`group:${GROUP_A}`, GROUP_A],
      [`group:${GROUP_B}`, GROUP_B],
    ]);
  });

  it('fuera de producción valida data y lanza si no cumple', () => {
    const { publisher, emits } = setup('test');
    const bad = { extra: true } as unknown as Record<string, never>;
    expect(() => publisher.publish(GROUP_A, 'session.revoked', bad)).toThrow(/data inválido para "session.revoked"/);
    expect(() => publisher.publishToUser(USER, 'session.revoked', bad)).toThrow();
    expect(emits).toHaveLength(0);
  });

  it('en producción no valida', () => {
    const { publisher, emits } = setup('production');
    publisher.publish(GROUP_A, 'session.revoked', { extra: true } as unknown as Record<string, never>);
    expect(emits).toHaveLength(1);
  });

  it('un error de emisión no se propaga', () => {
    const { publisher, emitImpl } = setup();
    emitImpl.mockImplementation(() => {
      throw new Error('socket roto');
    });
    expect(() => publisher.publish(GROUP_A, 'session.revoked', {})).not.toThrow();
    expect(() => publisher.publishToUser(USER, 'session.revoked', {})).not.toThrow();
  });

  it('un error al leer los grupos no se propaga', async () => {
    const { publisher, findMany, emits } = setup();
    findMany.mockRejectedValueOnce(new Error('BBDD caída'));
    await expect(publisher.publishToUserGroups(USER, 'session.revoked', {})).resolves.toBeUndefined();
    expect(emits).toHaveLength(0);
  });
});

/*
 * Comprobación de tipos (falla `pnpm typecheck` si se rompe):
 * publicar un evento sin entrada en RealtimeEventDataMap no compila.
 */
export function _typeChecks(publisher: RealtimePublisher): void {
  // @ts-expect-error -- 'task.created' todavía no tiene data en el mapa
  publisher.publish(GROUP_A, 'task.created', {});
  // @ts-expect-error -- data con forma incorrecta
  publisher.publishToUser(USER, 'session.revoked', { motivo: 'x' });
}
