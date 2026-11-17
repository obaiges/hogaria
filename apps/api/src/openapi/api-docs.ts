import swaggerUi from 'swagger-ui-express';

import { OpenApiService } from './openapi.service.js';

import type { INestApplication } from '@nestjs/common';
import type { Request, Response } from 'express';

export const API_DOCS_PATH = '/api/docs';

/**
 * Swagger UI en `/api/docs` y el documento en `/api/docs/openapi.json`. Solo se monta
 * en desarrollo (ver `configureApp`); en test y producción esas rutas dan 404.
 */
export function setupApiDocs(app: INestApplication): void {
  const openApi = app.get(OpenApiService);
  app.use(`${API_DOCS_PATH}/openapi.json`, (_req: Request, res: Response) => {
    res.json(openApi.document());
  });
  app.use(
    API_DOCS_PATH,
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      customSiteTitle: 'Hogaria API',
      swaggerOptions: { url: `${API_DOCS_PATH}/openapi.json` },
    }),
  );
}
