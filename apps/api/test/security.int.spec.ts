import { Body, Controller, Module, Post } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Public } from '../src/common/auth/decorators.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';

const APP_ORIGIN = 'https://hogaria.test'; // APP_URL de test/setup.ts

// Pública: aquí se prueban CORS, Origin y el cuerpo, no la sesión (HOG-055).
@Public()
@Controller('security-test')
class EchoController {
  @Post()
  echo(@Body() body: unknown) {
    return { received: body };
  }
}

@Module({ controllers: [EchoController] })
class EchoModule {}

describe('protecciones base de la API (HOG-014)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ imports: [EchoModule] });
  });

  afterAll(async () => {
    await t.close();
  });

  describe('Origin en mutaciones', () => {
    it('POST con Origin no permitido → 403 FORBIDDEN_ORIGIN', async () => {
      const res = await request(t.server)
        .post('/api/v1/security-test')
        .set('Origin', 'https://evil.example')
        .send({ a: 1 })
        .expect(403);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ status: 403, code: 'FORBIDDEN_ORIGIN', title: 'Origen no permitido' });
    });

    it('POST desde APP_URL o sin Origin pasa y lee el JSON', async () => {
      await request(t.server).post('/api/v1/security-test').set('Origin', APP_ORIGIN).send({ a: 1 }).expect(201, { received: { a: 1 } });
      await request(t.server).post('/api/v1/security-test').send({ b: 2 }).expect(201, { received: { b: 2 } });
    });

    it('GET con Origin ajeno no se bloquea (lo frena CORS en el navegador)', async () => {
      await request(t.server).get('/api/v1/health').set('Origin', 'https://evil.example').expect(200);
    });
  });

  describe('CORS', () => {
    it('preflight desde APP_URL → cabeceras con credenciales y X-Client-Mutation-Id', async () => {
      const res = await request(t.server)
        .options('/api/v1/security-test')
        .set('Origin', APP_ORIGIN)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type,x-client-mutation-id')
        .expect(204);
      expect(res.headers['access-control-allow-origin']).toBe(APP_ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-headers']?.toLowerCase()).toContain('x-client-mutation-id');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
    });

    it('preflight desde otro origen no recibe Access-Control-Allow-Origin', async () => {
      const res = await request(t.server)
        .options('/api/v1/security-test')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  it('helmet añade las cabeceras de seguridad', async () => {
    const res = await request(t.server).get('/api/v1/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  describe('cuerpo JSON', () => {
    it('más de 1 MB → 422 VALIDATION_ERROR en problem+json', async () => {
      const big = { text: 'x'.repeat(1024 * 1024 + 10) };
      const res = await request(t.server).post('/api/v1/security-test').send(big).expect(422);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR', status: 422 });
      expect(res.body.detail).toContain('1MB');
    });

    it('JSON mal formado → 422 VALIDATION_ERROR', async () => {
      const res = await request(t.server)
        .post('/api/v1/security-test')
        .set('Content-Type', 'application/json')
        .send('{"a":')
        .expect(422);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('rate limiting', () => {
    let limited: TestApp;

    beforeAll(async () => {
      limited = await createTestApp(); // almacén del throttler nuevo
    });

    afterAll(async () => {
      await limited.close();
    });

    it('la petición 121 en un minuto → 429 RATE_LIMITED con Retry-After', async () => {
      for (let i = 0; i < 120; i++) await request(limited.server).get('/api/v1/health').expect(200);
      const res = await request(limited.server).get('/api/v1/health').expect(429);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ status: 429, code: 'RATE_LIMITED' });
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('límite específico por ruta: GET /health/db admite 6 por minuto', async () => {
      for (let i = 0; i < 6; i++) await request(limited.server).get('/api/v1/health/db').expect(200);
      await request(limited.server).get('/api/v1/health/db').expect(429);
    });
  });
});
