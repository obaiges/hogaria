import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

import { API_ROOT, resolveTestDatabaseUrl } from './utils/test-db.js';

/**
 * Una vez por ejecución de la suite de integración: deja `hogaria_test` vacía y con
 * todas las migraciones aplicadas (`prisma migrate reset --force`). Prisma 7 ya no
 * ejecuta el seed en `migrate reset`, así que no hace falta `--skip-seed`.
 */
export default function setup(): void {
  const url = resolveTestDatabaseUrl();
  const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
  try {
    execFileSync(process.execPath, [prismaCli, 'migrate', 'reset', '--force'], {
      cwd: API_ROOT,
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
      stdio: 'pipe',
    });
  } catch (error) {
    const out = error as { stdout?: Buffer; stderr?: Buffer };
    const detail = [out.stdout?.toString(), out.stderr?.toString()].filter(Boolean).join('\n');
    throw new Error(
      `No se pudo resetear la BBDD de test. ¿Está arrancado Postgres (docker compose up -d db-test o TEST_DATABASE_URL en apps/api/.env.test)?\n${detail}`,
    );
  }
}
