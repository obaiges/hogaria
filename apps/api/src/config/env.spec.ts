import { describe, expect, it } from 'vitest';
import { validateEnv } from '../src/config/env.js';

describe('validateEnv', () => {
  it('lanza un error legible si falta DATABASE_URL', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'test',
        DIRECT_URL: 'postgresql://x',
      }),
    ).toThrow(/DATABASE_URL/);
  });
});
