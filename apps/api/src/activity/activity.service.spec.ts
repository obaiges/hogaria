import { describe, expect, it, vi } from 'vitest';

import { activityDto, type ActivityAction, type ActivityEntityType } from '@hogaria/shared';

import { requestContext } from '../common/context/request-context.js';
import { ActivityService, type RecordActivityInput } from './activity.service.js';

import type { RealtimePublisher } from '../realtime/realtime.publisher.js';
import type { ActivityLog, Prisma } from '@prisma/client';

const GROUP = '0193a0b2-0000-7000-8000-00000000000a';
const USER = '0193a0b2-0000-7000-8000-000000000001';
const ENTITY = '0193a0b2-0000-7000-8000-0000000000e1';

function setup() {
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: '0193a0b2-0000-7000-8000-0000000000aa',
    metadata: null,
    createdAt: new Date('2026-11-18T10:00:00.000Z'),
    ...data,
  }));
  const tx = { activityLog: { create } } as unknown as Prisma.TransactionClient;
  const publish = vi.fn();
  const service = new ActivityService({ publish } as unknown as RealtimePublisher);
  return { service, tx, create, publish };
}

const input: RecordActivityInput = {
  groupId: GROUP,
  actorId: USER,
  entityType: 'shopping_item',
  entityId: ENTITY,
  action: 'created',
  summary: 'añadió Leche a Compra',
};

function row(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: '0193a0b2-0000-7000-8000-0000000000aa',
    groupId: GROUP,
    actorId: USER,
    entityType: 'shopping_item',
    entityId: ENTITY,
    action: 'created',
    summary: 'añadió Leche a Compra',
    metadata: null,
    createdAt: new Date('2026-11-18T10:00:00.000Z'),
    ...overrides,
  };
}

describe('ActivityService.record (RN-03-25)', () => {
  it('escribe con el tx recibido', async () => {
    const { service, tx, create } = setup();
    await service.record(tx, { ...input, metadata: { listId: 'l1' } });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ ...input, metadata: { listId: 'l1' } }) });
  });

  it('rechaza un entityType o una action desconocidos', async () => {
    const { service, tx, create } = setup();
    await expect(service.record(tx, { ...input, entityType: 'nevera' as ActivityEntityType })).rejects.toThrow(/entityType desconocido/);
    await expect(service.record(tx, { ...input, action: 'exploded' as ActivityAction })).rejects.toThrow(/action desconocida/);
    expect(create).not.toHaveBeenCalled();
  });

  it('recorta el summary a 200 caracteres', async () => {
    const { service, tx, create } = setup();
    await service.record(tx, { ...input, summary: 'x'.repeat(250) });
    const summary = (create.mock.calls[0]![0].data as { summary: string }).summary;
    expect(Array.from(summary)).toHaveLength(200);
    expect(summary.endsWith('…')).toBe(true);
  });
});

describe('ActivityService.publishCreated (RN-03-26)', () => {
  it('publica activity.created con actorName del RequestContext', () => {
    const { service, publish } = setup();
    requestContext.run({ requestId: 'r', userId: USER, userName: 'Ana', sessionId: 's', clientMutationId: null }, () => service.publishCreated(row()));

    expect(publish).toHaveBeenCalledTimes(1);
    const [groupId, event, dto] = publish.mock.calls[0]!;
    expect([groupId, event]).toEqual([GROUP, 'activity.created']);
    expect(activityDto.parse(dto)).toEqual({
      id: '0193a0b2-0000-7000-8000-0000000000aa',
      groupId: GROUP,
      actorId: USER,
      actorName: 'Ana',
      entityType: 'shopping_item',
      entityId: ENTITY,
      action: 'created',
      summary: 'añadió Leche a Compra',
      metadata: null,
      createdAt: '2026-11-18T10:00:00.000Z',
    });
  });

  it('actor de sistema → actorName null', () => {
    const { service, publish } = setup();
    requestContext.run({ requestId: 'r', userId: USER, userName: 'Ana', sessionId: 's', clientMutationId: null }, () =>
      service.publishCreated(row({ actorId: null })),
    );
    expect(publish.mock.calls[0]![2]).toMatchObject({ actorId: null, actorName: null });
  });

  it('fuera de una petición o con otro actor → actorName null', () => {
    const { service, publish } = setup();
    service.publishCreated(row());
    requestContext.run({ requestId: 'r', userId: 'otro', userName: 'Luis', sessionId: 's', clientMutationId: null }, () => service.publishCreated(row()));
    expect(publish.mock.calls.map((c) => (c[2] as { actorName: unknown }).actorName)).toEqual([null, null]);
  });
});
