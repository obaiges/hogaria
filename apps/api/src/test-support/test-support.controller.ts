import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { createTestUserInput, TestSupportService, type CreateTestUserInput } from './test-support.service.js';

/**
 * Endpoints de apoyo para los e2e (HOG-011). El módulo solo se carga con
 * NODE_ENV=test: en desarrollo y producción estas rutas no existen (404).
 */
@SkipThrottle()
@Controller('test')
export class TestSupportController {
  constructor(private readonly testSupport: TestSupportService) {}

  /** Emails del FakeEmailSender, del más antiguo al más reciente. */
  @Get('emails')
  emails(@Query('to') to?: string) {
    return this.testSupport.emails(to);
  }

  /** Trunca todas las tablas y vacía los emails. */
  @Post('reset')
  @HttpCode(204)
  async reset(): Promise<void> {
    await this.testSupport.reset();
  }

  /** Usuario verificado con contraseña y, opcionalmente, un hogar (nuevo o existente). */
  @Post('users')
  createUser(@Body(new ZodValidationPipe(createTestUserInput)) body: CreateTestUserInput) {
    return this.testSupport.createUser(body);
  }
}
