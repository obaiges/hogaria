import { Body, Controller, Delete, HttpCode, Module, Param, Post } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ApiContract } from '../src/openapi/api-contract.decorator.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';

const createThingInput = z.object({ name: z.string().min(1) });
const thingDto = z.object({ id: z.string(), name: z.string() });

@Controller('things')
class ThingsController {
  @ApiContract({ summary: 'Crear cosa', body: createThingInput, response: thingDto })
  @Post()
  create(@Body() body: { name: string }) {
    return { id: '1', name: body.name };
  }

  @ApiContract({ params: z.object({ thingId: z.string() }), response: null })
  @HttpCode(204)
  @Delete(':thingId')
  remove(@Param('thingId') _id: string) {}

  /** Sin @ApiContract: no aparece en la documentación. */
  @Post('hidden')
  hidden() {
    return {};
  }
}

@Module({ controllers: [ThingsController] })
class ThingsModule {}

describe('documentación OpenAPI (HOG-016)', () => {
  it('con NODE_ENV=test /api/docs responde 404', async () => {
    const t = await createTestApp();
    try {
      await request(t.server).get('/api/docs').expect(404);
      await request(t.server).get('/api/docs/openapi.json').expect(404);
    } finally {
      await t.close();
    }
  });

  describe('montada (como en desarrollo)', () => {
    let t: TestApp;

    beforeAll(async () => {
      t = await createTestApp({ apiDocs: true, imports: [ThingsModule] });
    });

    afterAll(async () => {
      await t.close();
    });

    it('sirve Swagger UI', async () => {
      const res = await request(t.server).get('/api/docs/').expect(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('swagger-ui');
    });

    it('un endpoint nuevo con @ApiContract aparece sin más pasos', async () => {
      const { body: doc } = await request(t.server).get('/api/docs/openapi.json').expect(200);
      expect(doc.openapi).toBe('3.1.0');

      const create = doc.paths['/api/v1/things'].post;
      expect(create.summary).toBe('Crear cosa');
      expect(create.requestBody.content['application/json'].schema).toMatchObject({ required: ['name'] });
      expect(create.responses['201'].content['application/json'].schema).toMatchObject({ required: ['id', 'name'] });

      const remove = doc.paths['/api/v1/things/{thingId}'].delete;
      expect(remove.parameters).toEqual([expect.objectContaining({ name: 'thingId', in: 'path', required: true })]);
      expect(remove.responses['204']).toBeDefined();

      expect(doc.paths['/api/v1/things/hidden']).toBeUndefined();
      expect(doc.paths['/api/v1/health'].get.responses['200']).toBeDefined();
      expect(doc.paths['/api/v1/health/db'].get).toBeDefined();
    });
  });
});
