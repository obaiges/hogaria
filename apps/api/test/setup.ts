import { randomBytes } from 'node:crypto';

import { resolveTestDatabaseUrl } from './utils/test-db.js';

// Se ejecuta en cada archivo de test antes de importar la app: la API nunca ve
// la BBDD de desarrollo y los servicios externos son *fakes* (NODE_ENV=test).
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';
// Origen de la web en los tests (CORS y comprobación de Origin, HOG-014).
process.env.APP_URL = 'https://hogaria.test';
// Secreto aleatorio por ejecución (Better Auth firma las cookies con él).
process.env.BETTER_AUTH_SECRET ??= randomBytes(32).toString('base64');
const url = resolveTestDatabaseUrl();
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
