import { ConfigService } from '@nestjs/config';
import { toNodeHandler } from 'better-auth/node';
import helmet from 'helmet';

import { API_PREFIX } from './app.constants.js';
import { CLIENT_IP_HEADER } from './auth/auth-hooks.js';
import { AUTH, AUTH_BASE_PATH, type Auth } from './auth/auth.js';
import { getAllowedOrigins } from './common/security/allowed-origins.js';
import { bodyParserErrorHandler, jsonBodyParser } from './common/security/body-parser.js';
import { setupApiDocs } from './openapi/api-docs.js';
import { RealtimeIoAdapter } from './realtime/realtime-io.adapter.js';

import type { INestApplication } from '@nestjs/common';
import type { Express, NextFunction, Request, Response } from 'express';

export { API_PREFIX };

export interface ConfigureAppOptions {
  /** Swagger UI en `/api/docs`. Por defecto, solo con `NODE_ENV=development` (HOG-016). */
  apiDocs?: boolean;
}

/**
 * Configuración común de la app Nest. La usan `main.ts` y `createTestApp()` para que
 * los tests de integración arranquen exactamente la misma API.
 */
export function configureApp(app: INestApplication, options: ConfigureAppOptions = {}): INestApplication {
  const config = app.get(ConfigService);

  // Detrás de Caddy (red privada de Docker): la IP real llega en X-Forwarded-For.
  // Necesario para que el rate limit por IP no trate a todos como un único cliente.
  (app.getHttpAdapter().getInstance() as Express).set('trust proxy', 'loopback, uniquelocal');

  // La web y la API son el mismo sitio (obaiges.com): `same-site` en vez de `same-origin`.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));

  const allowedOrigins = getAllowedOrigins({ NODE_ENV: config.get('NODE_ENV'), APP_URL: config.get('APP_URL') });
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Client-Mutation-Id'],
    exposedHeaders: ['Retry-After', 'X-Request-Id'],
    maxAge: 600,
  });

  // Socket.IO en /realtime con el mismo CORS (spec 03, RN-03-01).
  app.useWebSocketAdapter(new RealtimeIoAdapter(app, allowedOrigins));

  if (options.apiDocs ?? config.get('NODE_ENV') === 'development') setupApiDocs(app);

  // Better Auth en /api/auth/* ANTES de cualquier parser de cuerpo: lee el cuerpo él
  // mismo. `all()` y no `use()`, porque `use()` recortaría el prefijo de req.url.
  const auth = app.get<Auth>(AUTH);
  // IP real para los límites y las sesiones: siempre desde req.ip (trust proxy), nunca la
  // cabecera que mande el cliente.
  const setClientIp = (req: Request, _res: Response, next: NextFunction) => {
    req.headers[CLIENT_IP_HEADER] = req.ip ?? 'unknown';
    next();
  };
  (app.getHttpAdapter().getInstance() as Express).all(`${AUTH_BASE_PATH}/{*splat}`, setClientIp, toNodeHandler(auth));

  app.use(`/${API_PREFIX}`, jsonBodyParser, bodyParserErrorHandler);
  app.setGlobalPrefix(API_PREFIX);
  return app;
}
