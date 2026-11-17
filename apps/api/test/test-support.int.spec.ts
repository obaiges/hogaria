import { Test } from '@nestjs/testing';
import { verifyPassword } from 'better-auth/crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { TestSupportModule } from '../src/test-support/test-support.module.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';

const prisma = getTestPrisma();

describe('test-support (HOG-011)', () => {
  describe('con NODE_ENV=test', () => {
    let t: TestApp;

    beforeAll(async () => {
      t = await createTestApp();
    });

    afterAll(async () => {
      await t.close();
    });

    it('POST /test/users crea un usuario verificado con contraseña y un hogar', async () => {
      const { body: a } = await request(t.server)
        .post('/api/v1/test/users')
        .send({ name: 'Ana', password: 'contraseña-larga', group: { name: 'Casa e2e' } })
        .expect(201);
      expect(a).toMatchObject({ name: 'Ana', password: 'contraseña-larga', laneColor: 'CORAL', groupId: expect.any(String) });

      const { body: b } = await request(t.server).post('/api/v1/test/users').send({ name: 'Óscar', joinGroupId: a.groupId }).expect(201);
      expect(b).toMatchObject({ groupId: a.groupId, laneColor: 'SEA' });

      const user = await prisma.user.findUniqueOrThrow({ where: { id: a.userId }, include: { accounts: true } });
      expect(user.emailVerified).toBe(true);
      await expect(verifyPassword({ hash: user.accounts[0]!.password!, password: 'contraseña-larga' })).resolves.toBe(true);
      expect(await prisma.groupMember.count({ where: { groupId: a.groupId } })).toBe(2);
    });

    it('valida el cuerpo y responde 404 si el hogar no existe', async () => {
      await request(t.server).post('/api/v1/test/users').send({ password: 'corta' }).expect(422);
      await request(t.server)
        .post('/api/v1/test/users')
        .send({ joinGroupId: '0190f3c4-0000-7000-8000-000000000000' })
        .expect(404);
    });

    it('GET /test/emails devuelve los emails del fake, filtrados por destinatario', async () => {
      await t.emails.send({ to: 'ana@e2e.local', subject: 'Verifica', text: 'https://hogaria.test/v?t=1', html: '' });
      await t.emails.send({ to: 'otro@e2e.local', subject: 'Otro', text: '', html: '' });
      const { body } = await request(t.server).get('/api/v1/test/emails').query({ to: 'ana@e2e.local' }).expect(200);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({ subject: 'Verifica', links: ['https://hogaria.test/v?t=1'] });
    });

    it('POST /test/reset trunca las tablas y vacía los emails', async () => {
      await request(t.server).post('/api/v1/test/users').send({ group: {} }).expect(201);
      await t.emails.send({ to: 'x@e2e.local', subject: 's', text: '', html: '' });
      await request(t.server).post('/api/v1/test/reset').expect(204);
      expect(await prisma.user.count()).toBe(0);
      expect(await prisma.group.count()).toBe(0);
      expect(t.emails.sent).toEqual([]);
    });
  });

  it('forEnv() solo incluye el controlador con NODE_ENV=test', () => {
    expect(TestSupportModule.forEnv('test').controllers).toHaveLength(1);
    expect(TestSupportModule.forEnv('production').controllers).toBeUndefined();
    expect(TestSupportModule.forEnv('development').providers).toBeUndefined();
  });

  for (const nodeEnv of ['production', 'development'] as const) {
    it(`con NODE_ENV=${nodeEnv} las rutas no existen (404)`, async () => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = nodeEnv;
      vi.resetModules();
      try {
        // AppModule se evalúa de nuevo con este NODE_ENV.
        const { AppModule } = await import('../src/app.module.js');
        const { configureApp } = await import('../src/app.setup.js');
        const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
        const app = configureApp(moduleRef.createNestApplication({ bodyParser: false, logger: false }), { apiDocs: false });
        await app.init();
        try {
          await request(app.getHttpServer()).get('/api/v1/test/emails').expect(404);
          await request(app.getHttpServer()).post('/api/v1/test/reset').expect(404);
          await request(app.getHttpServer()).post('/api/v1/test/users').send({}).expect(404);
        } finally {
          await app.close();
        }
      } finally {
        process.env.NODE_ENV = previous;
        vi.resetModules();
      }
    });
  }
});
