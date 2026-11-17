import { verifyPassword } from 'better-auth/crypto';
import { describe, expect, it } from 'vitest';

import { assertSeedAllowed, DEMO_PASSWORD, runSeed } from '../prisma/seed.js';
import { getTestPrisma } from './utils/prisma.js';

const prisma = getTestPrisma();

describe('seed mínimo de desarrollo (HOG-013)', () => {
  it('ejecutarlo dos veces deja 2 usuarios y 1 grupo con su semilla', async () => {
    await runSeed(prisma);
    const { group } = await runSeed(prisma);

    expect(await prisma.user.count()).toBe(2);
    expect(await prisma.group.count()).toBe(1);
    expect(await prisma.account.count()).toBe(2);
    expect(await prisma.groupMember.count()).toBe(2);
    expect(await prisma.shoppingList.count()).toBe(1);
    expect(await prisma.expenseCategory.count()).toBe(9);

    expect(group).toMatchObject({ name: 'Casa Demo', emoji: '🏠' });
    const list = await prisma.shoppingList.findFirstOrThrow();
    expect(list).toMatchObject({ name: 'Compra', emoji: '🛒', position: 0 });
    const categories = await prisma.expenseCategory.findMany({ orderBy: { position: 'asc' } });
    expect(categories[0]).toMatchObject({ name: 'Restaurantes', position: 0 });
    expect(categories[8]).toMatchObject({ name: 'Otros', position: 8 });
  });

  it('crea el dueño y el segundo usuario verificados, con cuenta credential y sus calles', async () => {
    await runSeed(prisma);
    const ana = await prisma.user.findUniqueOrThrow({ where: { email: 'ana@demo.local' }, include: { accounts: true, memberships: true } });
    const oscar = await prisma.user.findUniqueOrThrow({ where: { email: 'oscar@demo.local' }, include: { memberships: true } });

    expect(ana).toMatchObject({ username: 'ana', isPlatformAdmin: true, emailVerified: true });
    expect(oscar).toMatchObject({ username: 'oscar', isPlatformAdmin: false, emailVerified: true });
    expect(ana.memberships[0]?.laneColor).toBe('CORAL');
    expect(oscar.memberships[0]?.laneColor).toBe('SEA');

    const credential = ana.accounts.find((a) => a.providerId === 'credential');
    await expect(verifyPassword({ hash: credential!.password!, password: DEMO_PASSWORD })).resolves.toBe(true);
  });

  it('se niega en producción y contra BBDD remotas', () => {
    const local = 'postgresql://u:p@localhost:5432/hogaria';
    expect(() => assertSeedAllowed({ NODE_ENV: 'production', DATABASE_URL: local })).toThrow(/production/);
    expect(() => assertSeedAllowed({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/hogaria' })).toThrow(/local/);
    expect(() => assertSeedAllowed({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://u:p@ep-x.neon.tech/hogaria', SEED_ALLOW_REMOTE: 'true' })).not.toThrow();
    expect(() => assertSeedAllowed({ NODE_ENV: 'development' })).toThrow(/DATABASE_URL/);
    expect(() => assertSeedAllowed({ NODE_ENV: 'development', DATABASE_URL: local })).not.toThrow();
  });
});
