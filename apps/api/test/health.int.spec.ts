import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

import type { INestApplication } from '@nestjs/common';

describe('Health (integración)', () => {
  let app: INestApplication;

  describe('GET /api/v1/health', () => {
    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PrismaService)
        .useValue({ $queryRaw: vi.fn(), $connect: vi.fn(), $disconnect: vi.fn() })
        .compile();
      app = moduleRef.createNestApplication();
      app.setGlobalPrefix('api/v1');
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('responde 200 sin tocar la BBDD', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /api/v1/health/db', () => {
    it('responde 200 cuando la BBDD responde', async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PrismaService)
        .useValue({ $queryRaw: vi.fn().mockResolvedValue(1), $connect: vi.fn(), $disconnect: vi.fn() })
        .compile();
      const appDb = moduleRef.createNestApplication();
      appDb.setGlobalPrefix('api/v1');
      await appDb.init();
      const res = await request(appDb.getHttpServer()).get('/api/v1/health/db').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
      await appDb.close();
    });

    it('responde 503 cuando falla la BBDD', async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PrismaService)
        .useValue({ $queryRaw: vi.fn().mockRejectedValue(new Error('down')), $connect: vi.fn(), $disconnect: vi.fn() })
        .compile();
      const appDb = moduleRef.createNestApplication();
      appDb.setGlobalPrefix('api/v1');
      await appDb.init();
      const res = await request(appDb.getHttpServer()).get('/api/v1/health/db').expect(503);
      expect(res.body).toEqual({ status: 'error' });
      await appDb.close();
    });
  });
});