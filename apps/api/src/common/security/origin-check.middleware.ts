import { Injectable, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppError } from '../errors/app-error.js';
import { getAllowedOrigins, isForbiddenOrigin } from './allowed-origins.js';

import type { NextFunction, Request, Response } from 'express';

/**
 * CSRF: en `POST/PATCH/PUT/DELETE` bajo `/api/v1`, una cabecera `Origin` que no está en
 * la lista permitida → `403 FORBIDDEN_ORIGIN`. Better Auth hace su propia comprobación
 * con `trustedOrigins` en `/api/auth/*` (HOG-050).
 */
@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  private readonly allowed: string[];

  constructor(config: ConfigService) {
    this.allowed = getAllowedOrigins({ NODE_ENV: config.get('NODE_ENV'), APP_URL: config.get('APP_URL') });
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    if (isForbiddenOrigin(req.method, req.headers.origin, this.allowed)) {
      throw new AppError('FORBIDDEN_ORIGIN');
    }
    next();
  }
}
