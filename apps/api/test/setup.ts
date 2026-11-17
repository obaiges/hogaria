import { resolveTestDatabaseUrl } from './utils/test-db.js';

// Se ejecuta en cada archivo de test antes de importar la app: la API nunca ve
// la BBDD de desarrollo y los servicios externos son *fakes* (NODE_ENV=test).
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';
const url = resolveTestDatabaseUrl();
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
