import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // `prisma db seed` (Prisma 7 ya no siembra en `migrate reset`). También `pnpm db:seed`.
  migrations: { seed: 'node prisma/seed.ts' },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
