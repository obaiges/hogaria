import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { cursorQuery, decodeCursor, encodeCursor, paginated } from './pagination';

describe('cursorQuery', () => {
  it('limit por defecto 50, coacciona y acota a 1–100', () => {
    expect(cursorQuery.parse({})).toEqual({ limit: 50 });
    expect(cursorQuery.parse({ limit: '20', cursor: 'abc' })).toEqual({ limit: 20, cursor: 'abc' });
    expect(cursorQuery.safeParse({ limit: 0 }).success).toBe(false);
    expect(cursorQuery.safeParse({ limit: 101 }).success).toBe(false);
    expect(cursorQuery.safeParse({ cursor: '' }).success).toBe(false);
  });
});

describe('paginated', () => {
  it('valida items y nextCursor', () => {
    const schema = paginated(z.object({ id: z.string() }));
    expect(schema.parse({ items: [{ id: 'a' }], nextCursor: null })).toEqual({
      items: [{ id: 'a' }],
      nextCursor: null,
    });
    expect(schema.safeParse({ items: [{ id: 1 }], nextCursor: null }).success).toBe(false);
  });
});

describe('cursor opaco', () => {
  it('ida y vuelta, URL-safe', () => {
    const parts = ['2026-11-11', '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'];
    const cursor = encodeCursor(parts);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor, 2)).toEqual(parts);
  });

  it('soporta texto no ASCII y números', () => {
    expect(decodeCursor(encodeCursor(['Ñandú', 3]), 2)).toEqual(['Ñandú', 3]);
  });

  it('devuelve null si está corrupto o con otra longitud', () => {
    expect(decodeCursor('%%%')).toBeNull();
    expect(decodeCursor(encodeCursor(['a']), 2)).toBeNull();
    expect(decodeCursor(btoa('{"a":1}'))).toBeNull();
    expect(decodeCursor(btoa('[{"a":1}]'))).toBeNull();
  });
});
