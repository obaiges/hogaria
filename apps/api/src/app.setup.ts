import type { INestApplication } from '@nestjs/common';

export const API_PREFIX = 'api/v1';

/**
 * Configuración común de la app Nest. La usan `main.ts` y `createTestApp()` para que
 * los tests de integración arranquen exactamente la misma API.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix(API_PREFIX);
  return app;
}
