import { afterAll, beforeEach } from 'vitest';

import { disconnectTestPrisma, truncateAll } from './utils/prisma.js';

// Solo en la suite de integración: aislamiento por truncado (docs/07-testing.md).
beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await disconnectTestPrisma();
});
