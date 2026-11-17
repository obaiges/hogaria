import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { z } from 'zod';

import { RateLimit } from '../common/security/rate-limit.js';
import { ApiContract } from '../openapi/api-contract.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

const healthResponse = z.object({ status: z.literal('ok') });

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiContract({ summary: 'La API está viva (no toca la BBDD)', response: healthResponse })
  @Get()
  ok() {
    return { status: 'ok' };
  }

  /** 6 por minuto por IP (docs/03 §Protecciones web): toca la BBDD. */
  @ApiContract({ summary: 'La BBDD responde (503 si no)', response: healthResponse })
  @RateLimit(6, 60_000)
  @Get('db')
  async db() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new HttpException({ status: 'error' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}