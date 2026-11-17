import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

import { getAllowedOrigins } from './common/security/allowed-origins.js';
import { bodyParserErrorHandler, jsonBodyParser } from './common/security/body-parser.js';

import type { INestApplication } from '@nestjs/common';
import type { Express } from 'express';

export const API_PREFIX = 'api/v1';

/**
 * Configuración común de la app Nest. La usan `main.ts` y `createTestApp()` para que
 * los tests de integración arranquen exactamente la misma API.
 */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(ConfigService);

  // Detrás de Caddy (red privada de Docker): la IP real llega en X-Forwarded-For.
  // Necesario para que el rate limit por IP no trate a todos como un único cliente.
  (app.getHttpAdapter().getInstance() as Express).set('trust proxy', 'loopback, uniquelocal');

  // La web y la API son el mismo sitio (obaiges.com): `same-site` en vez de `same-origin`.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));

  app.enableCors({
    origin: getAllowedOrigins({ NODE_ENV: config.get('NODE_ENV'), APP_URL: config.get('APP_URL') }),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Client-Mutation-Id'],
    exposedHeaders: ['Retry-After', 'X-Request-Id'],
    maxAge: 600,
  });

  app.use(`/${API_PREFIX}`, jsonBodyParser, bodyParserErrorHandler);
  app.setGlobalPrefix(API_PREFIX);
  return app;
}
