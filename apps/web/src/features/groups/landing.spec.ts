import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearLastGroupId, LAST_GROUP_KEY, readLastGroupId, resolveLandingRoute, writeLastGroupId } from './landing';

const A = { id: 'g-a' };
const B = { id: 'g-b' };

describe('resolveLandingRoute (RN-02-30)', () => {
  it('lastGroupId de un grupo propio → ese grupo', () => {
    expect(resolveLandingRoute([A, B], 'g-b')).toEqual({ path: '/g/g-b', staleLastGroupId: false });
  });

  it('sin lastGroupId y un solo grupo → ese grupo', () => {
    expect(resolveLandingRoute([A], null)).toEqual({ path: '/g/g-a', staleLastGroupId: false });
  });

  it('varios grupos o ninguno → /grupos', () => {
    expect(resolveLandingRoute([A, B], null)).toEqual({ path: '/grupos', staleLastGroupId: false });
    expect(resolveLandingRoute([], null)).toEqual({ path: '/grupos', staleLastGroupId: false });
  });

  it('lastGroupId obsoleto: se ignora y se marca para borrar', () => {
    expect(resolveLandingRoute([A], 'g-viejo')).toEqual({ path: '/g/g-a', staleLastGroupId: true });
    expect(resolveLandingRoute([A, B], 'g-viejo')).toEqual({ path: '/grupos', staleLastGroupId: true });
    expect(resolveLandingRoute([], 'g-viejo')).toEqual({ path: '/grupos', staleLastGroupId: true });
  });
});

describe('lastGroupId en localStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('lee, escribe y borra', () => {
    writeLastGroupId('g-a');
    expect(localStorage.getItem(LAST_GROUP_KEY)).toBe('g-a');
    expect(readLastGroupId()).toBe('g-a');
    clearLastGroupId();
    expect(readLastGroupId()).toBeNull();
  });

  it('si localStorage falla, no lanza', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(readLastGroupId()).toBeNull();
    expect(() => writeLastGroupId('g-a')).not.toThrow();
  });
});
