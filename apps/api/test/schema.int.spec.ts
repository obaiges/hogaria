import { readFileSync } from 'node:fs';

import { PrismaPg } from '@prisma/adapter-pg';
import * as PrismaClient from '@prisma/client';
import pg from 'pg';
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

  it('el índice parcial impide dos presupuestos totales del mismo usuario y grupo', async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL requerida para este test');
    const pool = new pg.Pool({ connectionString: url });
    const prisma = new PrismaClient.PrismaClient({ adapter: new PrismaPg(pool) });
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: 'Test',
            email: `budget-${Date.now()}@test.local`,
          },
        });
        const group = await tx.group.create({ data: { name: 'Casa test' } });
        await tx.budget.create({
          data: { groupId: group.id, userId: user.id, amountCents: 1000 },
        });
        await expect(
          tx.budget.create({
            data: { groupId: group.id, userId: user.id, amountCents: 2000 },
          }),
        ).rejects.toMatchObject({ code: 'P2002' });
      });
    } finally {
      await prisma.$disconnect();
      await pool.end();
    }
  });
});
