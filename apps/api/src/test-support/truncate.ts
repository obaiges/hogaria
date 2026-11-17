import type { PrismaClient } from '@prisma/client';

const cache = new WeakMap<object, string[]>();

/**
 * Tablas del esquema `public` creadas por las migraciones (es decir, por el esquema
 * Prisma), salvo la tabla de control de Prisma. Se calcula una vez por cliente.
 */
export async function listTables(prisma: PrismaClient): Promise<string[]> {
  const cached = cache.get(prisma);
  if (cached) return cached;
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    ORDER BY tablename`;
  const tables = rows.map((r) => r.tablename);
  cache.set(prisma, tables);
  return tables;
}

/**
 * `TRUNCATE … RESTART IDENTITY CASCADE` de todas las tablas. Solo para la BBDD de test
 * (tests de integración y `POST /api/v1/test/reset` en e2e).
 */
export async function truncateAllTables(prisma: PrismaClient): Promise<void> {
  const names = await listTables(prisma);
  if (names.length === 0) return;
  const list = names.map((t) => `"public"."${t.replace(/"/g, '""')}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
