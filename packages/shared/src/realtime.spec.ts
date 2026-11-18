import { describe, expect, it } from 'vitest';

import { isRealtimeEventName, REALTIME_CHANNEL, REALTIME_EVENT_SCHEMAS, REALTIME_EVENTS } from './realtime';

describe('realtime', () => {
  it('canal único', () => {
    expect(REALTIME_CHANNEL).toBe('evt');
  });

  it('el catálogo coincide con docs/04 (instantánea)', () => {
    expect(REALTIME_EVENTS).toMatchSnapshot();
    expect(new Set(REALTIME_EVENTS).size).toBe(REALTIME_EVENTS.length);
  });

  it('los nombres siguen el formato entity.action en minúsculas', () => {
    for (const name of REALTIME_EVENTS) expect(name).toMatch(/^[a-z_]+(\.[a-z_]+)+$/);
  });

  it('isRealtimeEventName', () => {
    expect(isRealtimeEventName('task.completed')).toBe(true);
    expect(isRealtimeEventName('task.exploded')).toBe(false);
    expect(isRealtimeEventName(null)).toBe(false);
  });

  it('REALTIME_EVENT_SCHEMAS solo tiene eventos del catálogo', () => {
    for (const name of Object.keys(REALTIME_EVENT_SCHEMAS)) expect(isRealtimeEventName(name)).toBe(true);
  });

  it('session.revoked lleva data vacío y estricto', () => {
    const schema = REALTIME_EVENT_SCHEMAS['session.revoked'];
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ extra: 1 }).success).toBe(false);
    expect(schema.safeParse(null).success).toBe(false);
  });
});
