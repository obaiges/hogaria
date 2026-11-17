import { Controller, Get, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import {
  getRequestContext,
  requestContextMiddleware,
} from '../src/common/context/request-context.js';
import { AppError } from '../src/common/errors/app-error.js';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter.js';

describe('HOG-006 errores y contexto', () => {
  it('endpoint que lanza AppError devuelve problem+json', async () => {
    @Controller('test')
    class TestController {
      @Get('not-found')
      boom() {
        throw new AppError('NOT_FOUND');
      }
      @Get('ctx')
      ctx() {
        return getRequestContext() ?? null;
      }
    }
    @Module({ controllers: [TestController], providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }] })
    class TestModule {}

    const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(requestContextMiddleware);
    await app.init();

    const res = await request(app.getHttpServer()).get('/api/v1/test/not-found').expect(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ status: 404, code: 'NOT_FOUND', type: expect.stringContaining('not-found') });

    const ctxRes = await request(app.getHttpServer())
      .get('/api/v1/test/ctx')
      .set('X-Client-Mutation-Id', '123e4567-e89b-42d3-a456-426614174000')
      .expect(200);
    expect(ctxRes.body.clientMutationId).toBe('123e4567-e89b-42d3-a456-426614174000');
    await app.close();
  });
});
