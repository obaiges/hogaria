import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MEMBERSHIP_CACHE_TTL_MS, MembershipCache, type Membership } from './membership-cache.js';

const m = (memberId: string): Membership => ({ memberId, laneColor: 'CORAL', timezone: 'Europe/Madrid' });

describe('MembershipCache (RN-02-26)', () => {
  let cache: MembershipCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new MembershipCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sin entrada → undefined', () => {
    expect(cache.get('u1', 'g1')).toBeUndefined();
  });

  it('guarda positivos y negativos por userId:groupId', () => {
    cache.set('u1', 'g1', m('m1'));
    cache.set('u2', 'g1', null);
    expect(cache.get('u1', 'g1')).toEqual(m('m1'));
    expect(cache.get('u2', 'g1')).toBeNull();
    expect(cache.get('u1', 'g2')).toBeUndefined();
  });

  it('caduca a los 60 s (positivos y negativos)', () => {
    expect(MEMBERSHIP_CACHE_TTL_MS).toBe(60_000);
    cache.set('u1', 'g1', m('m1'));
    cache.set('u2', 'g1', null);

    vi.advanceTimersByTime(59_999);
    expect(cache.get('u1', 'g1')).toEqual(m('m1'));
    expect(cache.get('u2', 'g1')).toBeNull();

    vi.advanceTimersByTime(1);
    expect(cache.get('u1', 'g1')).toBeUndefined();
    expect(cache.get('u2', 'g1')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('volver a guardar reinicia la caducidad', () => {
    cache.set('u1', 'g1', null);
    vi.advanceTimersByTime(50_000);
    cache.set('u1', 'g1', m('m1'));
    vi.advanceTimersByTime(50_000);
    expect(cache.get('u1', 'g1')).toEqual(m('m1'));
  });

  it('invalidate borra solo esa pareja', () => {
    cache.set('u1', 'g1', m('m1'));
    cache.set('u1', 'g2', m('m2'));
    cache.set('u2', 'g1', m('m3'));
    cache.invalidate('u1', 'g1');
    expect(cache.get('u1', 'g1')).toBeUndefined();
    expect(cache.get('u1', 'g2')).toEqual(m('m2'));
    expect(cache.get('u2', 'g1')).toEqual(m('m3'));
  });

  it('invalidateGroup borra todas las entradas del grupo y nada más', () => {
    cache.set('u1', 'g1', m('m1'));
    cache.set('u2', 'g1', null);
    cache.set('u1', 'g10', m('m2')); // mismo prefijo: no debe caer
    cache.invalidateGroup('g1');
    expect(cache.get('u1', 'g1')).toBeUndefined();
    expect(cache.get('u2', 'g1')).toBeUndefined();
    expect(cache.get('u1', 'g10')).toEqual(m('m2'));
  });

  it('barre las caducadas cuando crece mucho', () => {
    for (let i = 0; i < 5_000; i++) cache.set(`u${i}`, 'g1', null);
    vi.advanceTimersByTime(MEMBERSHIP_CACHE_TTL_MS);
    cache.set('nuevo', 'g1', null);
    expect(cache.size).toBe(1);
  });
});
