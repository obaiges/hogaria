import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './auth/auth.module.js';
import { AuthGuard } from './common/auth/auth.guard.js';
import { requestContextMiddleware } from './common/context/request-context.js';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter.js';
import { GroupAccessModule } from './common/guards/group-access.module.js';
import { OriginCheckMiddleware } from './common/security/origin-check.middleware.js';
import { AppThrottlerGuard, DEFAULT_RATE_LIMIT } from './common/security/rate-limit.js';
import { validateEnv } from './config/env.js';
import { ExternalServicesModule } from './external-services.module.js';
import { HealthModule } from './health/health.module.js';
import { MeModule } from './me/me.module.js';
import { OpenApiModule } from './openapi/openapi.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TestSupportModule } from './test-support/test-support.module.js';

import type { MiddlewareConsumer, NestModule } from '@nestjs/common';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        genReqId: (req, res) => {
          const existing = req.headers['x-request-id'];
          const id = typeof existing === 'string' ? existing : randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
          censor: '[redacted]',
        },
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
      },
    }),
    ThrottlerModule.forRoot([{ name: 'default', ...DEFAULT_RATE_LIMIT }]),
    PrismaModule,
    GroupAccessModule,
    ExternalServicesModule,
    AuthModule,
    HealthModule,
    MeModule,
    OpenApiModule,
    // Solo con NODE_ENV=test (e2e, HOG-011); vacío en desarrollo y producción.
    TestSupportModule.forEnv(),
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    // Orden: primero la sesión (rellena userId), después el throttler (cuenta por usuario).
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Sintaxis de Express 5 / path-to-regexp 8 para "todas las rutas".
    consumer.apply(requestContextMiddleware, OriginCheckMiddleware).forRoutes('{*path}');
  }
}
