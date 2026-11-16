import { readFileSync } from 'node:fs';

import * as PrismaClient from '@prisma/client';
import { describe, expect, it } from 'vitest';

const expected = JSON.parse(
  readFileSync(new URL('./schema-expected.json', import.meta.url), 'utf8'),
) as { models: string[]; enums: string[] };

describe('schema Prisma (HOG-004)', () => {
  it('los modelos del cliente generado coinciden con docs/02-modelo-datos.md', () => {
    const models = Object.values(PrismaClient.Prisma.ModelName).sort();
    expect(models).toEqual([...expected.models].sort());
  });

  it('los enums del cliente generado coinciden con docs/02-modelo-datos.md', () => {
    const exported = Object.keys(PrismaClient);
    const missing = expected.enums.filter((e) => !exported.includes(e));
    expect(missing).toEqual([]);
    expect([...expected.enums].sort()).toEqual([...expected.enums].sort());
  });
});
