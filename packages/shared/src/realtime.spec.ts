import { describe, expect, it } from 'vitest';

import { isRealtimeEventName, REALTIME_CHANNEL, REALTIME_EVENTS } from './realtime';

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
});
