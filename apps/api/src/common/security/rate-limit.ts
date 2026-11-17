import { Injectable } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { getRequestContext } from '../context/request-context.js';

/** Límite general: 120 peticiones por minuto (docs/03 §Protecciones web). */
export const DEFAULT_RATE_LIMIT = { ttl: 60_000, limit: 120 } as const;

/**
 * Límite específico de una ruta o controlador, por ejemplo `@RateLimit(6, 60_000)`
 * para `GET /health/db`. Sustituye al general en esa ruta.
 */
export const RateLimit = (limit: number, ttlMs: number) => Throttle({ default: { limit, ttl: ttlMs } });

/** Throttler global: cuenta por usuario autenticado o, sin sesión, por IP. */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const userId = getRequestContext()?.userId;
    if (userId) return Promise.resolve(`user:${userId}`);
    const ip = typeof req.ip === 'string' && req.ip ? req.ip : 'unknown';
    return Promise.resolve(`ip:${ip}`);
  }
}
