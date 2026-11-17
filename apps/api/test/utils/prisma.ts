import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

let pool: pg.Pool | undefined;
let client: PrismaClient | undefined;
let tables: string[] | undefined;

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

/**
 * Tablas del esquema `public` creadas por las migraciones (es decir, por el esquema
 * Prisma), salvo la tabla de control de Prisma. Se calcula una vez por proceso.
 */
export async function listTables(prisma: PrismaClient = getTestPrisma()): Promise<string[]> {
  if (!tables) {
    const rows = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
      ORDER BY tablename`;
    tables = rows.map((r) => r.tablename);
  }
  return tables;
}

/** `TRUNCATE … RESTART IDENTITY CASCADE` de todas las tablas: cada test empieza con la BBDD vacía. */
export async function truncateAll(prisma: PrismaClient = getTestPrisma()): Promise<void> {
  const names = await listTables(prisma);
  if (names.length === 0) return;
  const list = names.map((t) => `"public"."${t.replace(/"/g, '""')}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function disconnectTestPrisma(): Promise<void> {
  await client?.$disconnect();
  await pool?.end();
  client = undefined;
  pool = undefined;
}
