import { describe, expect, it } from 'vitest';

import { UUID_V7_PATTERN, uuidv7 } from './uuidv7.js';

describe('uuidv7', () => {
  it('tiene versión 7 y variante RFC 9562', () => {
    for (let i = 0; i < 100; i++) expect(uuidv7()).toMatch(UUID_V7_PATTERN);
  });

  it('codifica el instante en los 48 primeros bits', () => {
    const now = Date.UTC(2026, 10, 17, 9, 30);
    const id = uuidv7(now);
    expect(Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(now);
  });

  it('se ordena por tiempo y no se repite', () => {
    const a = uuidv7(1_000);
    const b = uuidv7(2_000);
    expect(a < b).toBe(true);
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7()));
    expect(ids.size).toBe(1000);
  });
});
