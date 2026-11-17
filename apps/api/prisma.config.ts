import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // `prisma db seed` (Prisma 7 ya no siembra en `migrate reset`). También `pnpm db:seed`.
  migrations: { seed: 'node prisma/seed.ts' },
  // `prisma generate` (postinstall) no necesita BBDD: en un clon limpio o en CI no hay
  // DATABASE_URL al instalar. Los comandos que sí la usan (migrate, db) fallan con un
  // error claro de Prisma si falta.
  ...(process.env.DATABASE_URL ? { datasource: { url: env('DATABASE_URL') } } : {}),
});
