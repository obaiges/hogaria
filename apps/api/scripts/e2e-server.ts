/**
 * Arranca la API para los e2e de Playwright (HOG-011): `node scripts/e2e-server.ts`.
 *
 * 1. Resuelve la BBDD de test igual que los tests de integración
 *    (TEST_DATABASE_URL → apps/api/.env.test → localhost:5433) y se niega a usar una
 *    que no acabe en `_test`.
 * 2. Aplica las migraciones pendientes (`prisma migrate deploy`, no borra datos: cada
 *    e2e limpia con `POST /api/v1/test/reset`).
 * 3. Compila (`nest build`) y arranca `dist/main.js` con NODE_ENV=test, así que se
 *    cargan los *fakes* y el módulo test-support.
 *
 * Se ejecuta con Node (type stripping): solo importa módulos de Node y paquetes.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';

const API_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_TEST_DATABASE_URL = 'postgresql://hogaria:hogaria@localhost:5433/hogaria_test';

const E2E_API_PORT = process.env.E2E_API_PORT ?? '3100';
const E2E_WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:4173';

function resolveTestDatabaseUrl(): string {
  const envFile = resolve(API_ROOT, '.env.test');
  if (!process.env.TEST_DATABASE_URL && existsSync(envFile)) loadEnv({ path: envFile, quiet: true });
  const url = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  if (!name.endsWith('_test')) throw new Error(`Los e2e solo se ejecutan contra una BBDD *_test (recibida: "${name}")`);
  return url;
}

const require = createRequire(import.meta.url);
const url = resolveTestDatabaseUrl();
const env = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: E2E_API_PORT,
  APP_URL: E2E_WEB_URL,
  API_URL: `http://localhost:${E2E_API_PORT}`,
  DATABASE_URL: url,
  DIRECT_URL: url,
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'warn',
  PRISMA_HIDE_UPDATE_MESSAGE: '1',
};

const run = (script: string, args: string[]) =>
  execFileSync(process.execPath, [script, ...args], { cwd: API_ROOT, env, stdio: 'inherit' });

run(require.resolve('prisma/build/index.js'), ['migrate', 'deploy']);
run(require.resolve('@nestjs/cli/bin/nest.js'), ['build']);

const api = spawn(process.execPath, ['dist/main.js'], { cwd: API_ROOT, env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => api.kill(signal));
api.on('exit', (code) => process.exit(code ?? 0));
