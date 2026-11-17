import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

import { truncateAllTables } from '../../src/test-support/truncate.js';

export { listTables } from '../../src/test-support/truncate.js';

let pool: pg.Pool | undefined;
let client: PrismaClient | undefined;

/** Cliente Prisma de los tests (factories y comprobaciones), contra `hogaria_test`. */
export function getTestPrisma(): PrismaClient {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL no está definida: ¿falta test/setup.ts?');
    pool = new pg.Pool({ connectionString: url, max: 4 });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
  }
  return client;
}

/** `TRUNCATE … RESTART IDENTITY CASCADE` de todas las tablas: cada test empieza con la BBDD vacía. */
export async function truncateAll(prisma: PrismaClient = getTestPrisma()): Promise<void> {
  await truncateAllTables(prisma);
}

export async function disconnectTestPrisma(): Promise<void> {
  await client?.$disconnect();
  await pool?.end();
  client = undefined;
  pool = undefined;
}
