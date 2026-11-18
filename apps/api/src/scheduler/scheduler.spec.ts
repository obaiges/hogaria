import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MaintenanceCron } from './maintenance.cron.js';
import { RETENTION_MIN_INTERVAL_MS, RetentionJob } from './retention.job.js';
import { SchedulerTickRegistry } from './scheduler-tick.registry.js';

import type { PrismaService } from '../prisma/prisma.service.js';

describe('SchedulerTickRegistry y MaintenanceCron (RN-03-25)', () => {
  it('ejecuta los handlers por order ascendente', async () => {
    const registry = new SchedulerTickRegistry();
    const calls: string[] = [];
    const handler = (name: string, order: number) => ({ name, order, run: async () => void calls.push(name) });
    registry.register(handler('reminders.reconcile', 100));
    registry.register(handler('retention.purge', 20));
    registry.register(handler('bills.materialize', 10));

    const result = await new MaintenanceCron(registry).runNow();
    expect(calls).toEqual(['bills.materialize', 'retention.purge', 'reminders.reconcile']);
    expect(result).toEqual({ ran: true, failed: [] });
  });

  it('un handler que lanza se registra y no detiene a los demás', async () => {
    const registry = new SchedulerTickRegistry();
    const after = vi.fn(async () => {});
    registry.register({ name: 'roto', order: 1, run: async () => Promise.reject(new Error('boom')) });
    registry.register({ name: 'sigue', order: 2, run: after });

    const result = await new MaintenanceCron(registry).runNow();
    expect(after).toHaveBeenCalledTimes(1);
    expect(result.failed).toEqual(['roto']);
  });

  it('no solapa ticks: si el anterior sigue en curso, el nuevo se salta', async () => {
    const registry = new SchedulerTickRegistry();
    let release!: () => void;
    const run = vi.fn(async () => {}).mockImplementationOnce(() => new Promise<void>((r) => (release = r)));
    registry.register({ name: 'lento', order: 1, run });
    const cron = new MaintenanceCron(registry);

    const first = cron.runNow();
    expect(await cron.runNow()).toEqual({ ran: false, failed: [] });
    release();
    expect(await first).toEqual({ ran: true, failed: [] });
    expect(run).toHaveBeenCalledTimes(1);
    await cron.runNow();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('pasa la misma fecha a todos los handlers', async () => {
    const registry = new SchedulerTickRegistry();
    const run = vi.fn(async () => {});
    registry.register({ name: 'a', order: 1, run });
    const now = new Date('2026-11-18T06:00:00Z');
    await new MaintenanceCron(registry).runNow(now);
    expect(run).toHaveBeenCalledWith(now);
  });

  it('no admite dos handlers con el mismo nombre', () => {
    const registry = new SchedulerTickRegistry();
    registry.register({ name: 'a', order: 1, run: async () => {} });
    expect(() => registry.register({ name: 'a', order: 2, run: async () => {} })).toThrow(/ya está registrado/);
  });
});

describe('RetentionJob (RN-03-24)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-18T06:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const activityDelete = vi.fn(async () => ({ count: 0 }));
    const securityDelete = vi.fn(async () => ({ count: 0 }));
    const prisma = { activityLog: { deleteMany: activityDelete }, securityEvent: { deleteMany: securityDelete } } as unknown as PrismaService;
    const registry = new SchedulerTickRegistry();
    const job = new RetentionJob(prisma, registry);
    job.onModuleInit();
    return { job, registry, activityDelete, securityDelete };
  }

  it('se registra como retention.purge con orden 20', () => {
    const { registry } = setup();
    expect(registry.list().map(({ name, order }) => ({ name, order }))).toEqual([{ name: 'retention.purge', order: 20 }]);
  });

  it('dos ticks en menos de 24 h → una sola purga; a las 24 h, otra', async () => {
    const { registry, activityDelete } = setup();
    const cron = new MaintenanceCron(registry);

    await cron.runNow(new Date());
    vi.advanceTimersByTime(6 * 60 * 60 * 1000);
    await cron.runNow(new Date());
    expect(activityDelete).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(RETENTION_MIN_INTERVAL_MS - 6 * 60 * 60 * 1000);
    await cron.runNow(new Date());
    expect(activityDelete).toHaveBeenCalledTimes(2);
  });

  it('corta en 90 días la actividad y en 180 los SecurityEvent', async () => {
    const { job, activityDelete, securityDelete } = setup();
    await job.run(new Date('2026-11-18T06:00:00Z'));
    expect(activityDelete).toHaveBeenCalledWith({ where: { createdAt: { lt: new Date('2026-08-20T06:00:00Z') } } });
    expect(securityDelete).toHaveBeenCalledWith({ where: { createdAt: { lt: new Date('2026-05-22T06:00:00Z') } } });
  });
});
