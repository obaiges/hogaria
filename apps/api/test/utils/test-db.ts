import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';

/** Postgres de `docker compose up -d db-test` (docs/07-testing.md). */
export const DEFAULT_TEST_DATABASE_URL = 'postgresql://hogaria:hogaria@localhost:5433/hogaria_test';

const API_ROOT = resolve(import.meta.dirname, '../..');

/**
 * URL de la BBDD de integración. Orden: variable `TEST_DATABASE_URL`, después
 * `apps/api/.env.test` (no versionado; útil con un Postgres nativo sin Docker) y, si no,
 * el contenedor del puerto 5433. Nunca se usa `DATABASE_URL` de `.env`.
 */
export function resolveTestDatabaseUrl(): string {
  const envFile = resolve(API_ROOT, '.env.test');
  if (!process.env.TEST_DATABASE_URL && existsSync(envFile)) {
    loadEnv({ path: envFile, quiet: true });
  }
  const url = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  assertTestDatabase(url);
  return url;
}

/** Protección: los tests truncan y resetean, así que solo se aceptan BBDD cuyo nombre acabe en `_test`. */
export function assertTestDatabase(url: string): void {
  let name: string;
  try {
    name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    throw new Error('TEST_DATABASE_URL no es una URL de Postgres válida');
  }
  if (!name.endsWith('_test')) {
    throw new Error(`Los tests solo se ejecutan contra una BBDD *_test (recibida: "${name}")`);
  }
}

export { API_ROOT };
