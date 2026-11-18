import { randomBytes } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PASSWORD_POLICY_MESSAGES } from '@hogaria/shared/common-passwords';

import { AuthRequestLimiter } from '../src/auth/rate-limit/auth-request-limiter.js';
import { LoginRateLimiter } from '../src/auth/rate-limit/login-rate-limiter.js';
import { createUser, inviteCookie, loginAs } from './factories/index.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';

const prisma = getTestPrisma();
const ORIGIN = 'https://hogaria.test';
const PASSWORD = 'contraseña-de-prueba';

describe('seguridad de /api/auth (HOG-058)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => {
    t.app.get(LoginRateLimiter).clear();
    t.app.get(AuthRequestLimiter).clear();
  });

  afterAll(async () => {
    await t.close();
  });

  const post = (path: string, body: object) => request(t.server).post(`/api/auth${path}`).set('Origin', ORIGIN).send(body);
  const events = (type: string) => prisma.securityEvent.findMany({ where: { type: type as never }, orderBy: { createdAt: 'asc' } });

  describe('fuerza bruta en el login (RN-01-26)', () => {
    it('5 fallos en un minuto: el 6.º intento → 429 RATE_LIMITED con Retry-After', async () => {
      const user = await createUser({ email: 'ana@demo.local', password: PASSWORD });
      for (let i = 0; i < 5; i++) {
        const res = await post('/sign-in/email', { email: 'ana@demo.local', password: 'mala-contraseña' });
        expect(res.status).toBe(401);
      }
      const blocked = await post('/sign-in/email', { email: 'ANA@demo.local', password: PASSWORD });
      expect(blocked.status).toBe(429);
      expect(blocked.body.code).toBe('RATE_LIMITED');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
      expect(Number(blocked.headers['retry-after'])).toBeLessThanOrEqual(60);

      const failed = await events('LOGIN_FAILED');
      expect(failed).toHaveLength(5);
      expect(failed[0]).toMatchObject({ userId: user.id, identifier: 'ana@demo.local' });
      expect(failed[0]!.ipAddress).toBeTruthy();
      expect(JSON.stringify(failed)).not.toContain('mala-contraseña');
    });

    it('el mismo límite vale para el login por username', async () => {
      await createUser({ username: 'oscar', password: PASSWORD });
      for (let i = 0; i < 5; i++) await post('/sign-in/username', { username: 'oscar', password: 'nope-nope-nope' }).expect(401);
      await post('/sign-in/username', { username: 'OSCAR', password: PASSWORD }).expect(429);
    });

    it('LOGIN_FAILED de un identificador que no existe no lleva userId', async () => {
      await post('/sign-in/email', { email: 'nadie@demo.local', password: 'lo-que-sea-123' }).expect(401);
      expect((await events('LOGIN_FAILED'))[0]).toMatchObject({ userId: null, identifier: 'nadie@demo.local' });
    });

    it('un login correcto reinicia el contador y registra LOGIN_SUCCESS', async () => {
      const user = await createUser({ email: 'leo@demo.local', password: PASSWORD });
      for (let i = 0; i < 4; i++) await post('/sign-in/email', { email: 'leo@demo.local', password: 'mala-mala-1' }).expect(401);
      await post('/sign-in/email', { email: 'leo@demo.local', password: PASSWORD }).expect(200);
      for (let i = 0; i < 5; i++) await post('/sign-in/email', { email: 'leo@demo.local', password: 'mala-mala-2' }).expect(401);

      expect(await events('LOGIN_SUCCESS')).toEqual([expect.objectContaining({ userId: user.id, identifier: null })]);
    });

    it('la IP no se puede falsear con la cabecera interna', async () => {
      await createUser({ email: 'eva@demo.local', password: PASSWORD });
      for (let i = 0; i < 5; i++) {
        await post('/sign-in/email', { email: 'eva@demo.local', password: 'mala-mala-3' }).set('X-Hogaria-Client-Ip', `10.9.9.${i}`).expect(401);
      }
      await post('/sign-in/email', { email: 'eva@demo.local', password: PASSWORD }).set('X-Hogaria-Client-Ip', '10.9.9.99').expect(429);
    });

    it('el tiempo de respuesta no delata si el usuario existe (RN-01-29)', async () => {
      await createUser({ email: 'real@demo.local', password: PASSWORD });
      const time = async (email: string) => {
        const start = performance.now();
        await post('/sign-in/email', { email, password: 'incorrecta-123' }).expect(401);
        return performance.now() - start;
      };
      // Alterna para repartir el ruido; mediana de 4 de cada.
      const existing: number[] = [];
      const missing: number[] = [];
      for (let i = 0; i < 4; i++) {
        existing.push(await time('real@demo.local'));
        missing.push(await time(`fantasma${i}@demo.local`));
        t.app.get(LoginRateLimiter).clear();
      }
      const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
      const ratio = median(missing) / median(existing);
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(2);
    });
  });

  describe('política de contraseñas (RN-01-10)', () => {
    it('registro con contraseña común → 422 VALIDATION_ERROR con el mensaje de la spec', async () => {
      const res = await post('/sign-up/email', { name: 'Ana', email: 'nueva@demo.local', username: 'nueva', password: '1234567890' });
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR', message: PASSWORD_POLICY_MESSAGES.common });
      expect(await prisma.user.count()).toBe(0);
    });

    it('registro con una contraseña que contiene el username → 422', async () => {
      const res = await post('/sign-up/email', { name: 'Ana', email: 'otra@demo.local', username: 'anagarcia', password: 'yo-soy-ANAGARCIA' });
      expect(res.status).toBe(422);
      expect(res.body.message).toBe(PASSWORD_POLICY_MESSAGES.identity);
    });

    it('restablecer con contraseña común → 422; con una válida → 200 y PASSWORD_CHANGED', async () => {
      const user = await createUser({ email: 'reset@demo.local', password: PASSWORD });
      const token = randomBytes(16).toString('hex');
      await prisma.verification.create({
        data: { identifier: `reset-password:${token}`, value: user.id, expiresAt: new Date(Date.now() + 30 * 60_000) },
      });

      const common = await post('/reset-password', { token, newPassword: 'qwertyuiop' });
      expect(common.status).toBe(422);
      expect(common.body.message).toBe(PASSWORD_POLICY_MESSAGES.common);
      const withEmail = await post('/reset-password', { token, newPassword: 'x-reset@demo.local-x' });
      expect(withEmail.status).toBe(422);

      await post('/reset-password', { token, newPassword: 'una-contraseña-nueva-9' }).expect(200);
      expect(await events('PASSWORD_CHANGED')).toEqual([expect.objectContaining({ userId: user.id })]);
    });

    it('cambiar la contraseña con una común → 422; con una válida → PASSWORD_CHANGED', async () => {
      const user = await createUser({ password: PASSWORD });
      const agent = await loginAs(user, t.server);
      const change = (newPassword: string) =>
        agent.post('/api/auth/change-password').set('Origin', ORIGIN).send({ currentPassword: PASSWORD, newPassword, revokeOtherSessions: true });

      const common = await change('1q2w3e4r5t');
      expect(common.status).toBe(422);
      await change('otra-contraseña-larga-7').expect(200);
      expect(await events('PASSWORD_CHANGED')).toEqual([expect.objectContaining({ userId: user.id })]);
    });
  });

  describe('bloqueo y cierre de sesión', () => {
    it('un usuario bloqueado no crea sesión: 403 ACCOUNT_BLOCKED (RN-01-25)', async () => {
      const user = await createUser({ email: 'bloq@demo.local', password: PASSWORD, blockedAt: new Date() });
      const res = await post('/sign-in/email', { email: 'bloq@demo.local', password: PASSWORD });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_BLOCKED');
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    });

    it('cerrar sesión registra LOGOUT', async () => {
      const user = await createUser();
      const agent = await loginAs(user, t.server);
      await agent.post('/api/auth/sign-out').set('Origin', ORIGIN).expect(200);
      expect(await events('LOGOUT')).toEqual([expect.objectContaining({ userId: user.id })]);
      await agent.get('/api/v1/me').expect(401);
    });
  });

  describe('otros límites de /api/auth (RN-01-27)', () => {
    it('registro: 5 por hora por IP; el 6.º → 429', async () => {
      for (let i = 0; i < 5; i++) {
        await post('/sign-up/email', { name: 'U', email: `u${i}@demo.local`, username: `usuario${i}`, password: 'contraseña-larga-1' })
          .set('Cookie', await inviteCookie())
          .expect(200);
      }
      const res = await post('/sign-up/email', { name: 'U', email: 'u9@demo.local', username: 'usuario9', password: 'contraseña-larga-1' });
      expect(res.status).toBe(429);
      expect(res.headers['retry-after']).toBeDefined();
    });

    it('las llamadas internas de la API (AuthGuard) no cuentan para el límite de 60/min', async () => {
      const agent = await loginAs(await createUser(), t.server);
      for (let i = 0; i < 65; i++) await agent.get('/api/v1/me').expect(200);
    });
  });
});
