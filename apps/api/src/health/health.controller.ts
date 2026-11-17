import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

import { RateLimit } from '../common/security/rate-limit.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  ok() {
    return { status: 'ok' };
  }

  /** 6 por minuto por IP (docs/03 §Protecciones web): toca la BBDD. */
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