import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuth } from '../src/auth/auth.js';
import { UUID_V7_PATTERN } from '../src/common/ids/uuidv7.js';
import { FakeEmailSender } from '../src/email/fake-email-sender.js';
import { createUser, loginAs } from './factories/index.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';

const prisma = getTestPrisma();
const ORIGIN = 'https://hogaria.test'; // APP_URL de test/setup.ts
const PASSWORD = 'contraseña-de-prueba';

function sessionCookie(res: request.Response): string | undefined {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return cookies.find((c) => c.startsWith('hogaria.session_token='));
}

describe('Better Auth básico (HOG-050)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  const signUp = (body: Record<string, unknown>) => request(t.server).post('/api/auth/sign-up/email').set('Origin', ORIGIN).send(body);

  it('el registro crea un User con id UUIDv7 sin verificar, su cuenta credential y envía la verificación', async () => {
    t.emails.clear();
    const res = await signUp({ name: 'Ana', email: 'Ana@Demo.Local', username: 'Ana_G', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toBeUndefined(); // requireEmailVerification: sin sesión hasta verificar

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'ana@demo.local' }, include: { accounts: true } });
    expect(user.id).toMatch(UUID_V7_PATTERN);
    expect(user).toMatchObject({ name: 'Ana', emailVerified: false, username: 'ana_g', displayUsername: 'Ana_G' });
    expect(user.accounts).toHaveLength(1);
    expect(user.accounts[0]).toMatchObject({ providerId: 'credential' });
    expect(user.accounts[0]!.id).toMatch(UUID_V7_PATTERN);
    expect(user.accounts[0]!.password).not.toContain(PASSWORD);

    const email = t.emails.last('ana@demo.local');
    expect(email?.subject).toBe('Confirma tu email en Hogaria');
    const link = new URL(email!.links[0]!);
    expect(link.pathname).toBe('/api/auth/verify-email');
    expect(link.searchParams.get('callbackURL')).toBe(`${ORIGIN}/`);
  });

  it('rechaza un username no válido y una contraseña corta con 422 VALIDATION_ERROR (spec 01 §5.1)', async () => {
    const bad = await signUp({ name: 'X', email: 'x@demo.local', username: '.mal', password: PASSWORD });
    expect(bad.status).toBe(422);
    expect(bad.body).toMatchObject({ code: 'VALIDATION_ERROR', message: expect.stringContaining('sin empezar ni acabar en punto') });
    const short = await signUp({ name: 'X', email: 'y@demo.local', username: 'valido', password: 'corta' });
    expect(short.status).toBe(422);
    expect(short.body.message).toBe('La contraseña debe tener al menos 10 caracteres');
    expect(await prisma.user.count()).toBe(0);
  });

  it('sin verificar no entra y se reenvía el enlace; al abrirlo verifica, crea la sesión y vuelve a la web', async () => {
    await signUp({ name: 'Leo', email: 'leo@demo.local', username: 'leo', password: PASSWORD }).expect(200);
    t.emails.clear();

    const denied = await request(t.server).post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email: 'leo@demo.local', password: PASSWORD });
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('EMAIL_NOT_VERIFIED');
    const link = new URL(t.emails.last('leo@demo.local')!.links[0]!);

    const verified = await request(t.server).get(`${link.pathname}${link.search}`);
    expect(verified.status).toBe(302);
    expect(verified.headers.location).toBe(`${ORIGIN}/`);
    expect(sessionCookie(verified)).toBeDefined(); // autoSignInAfterVerification
    expect((await prisma.user.findUniqueOrThrow({ where: { email: 'leo@demo.local' } })).emailVerified).toBe(true);
  });

  it('login por email: cookie hogaria.session_token HttpOnly, SameSite=Lax y sesión UUIDv7 de 365 días', async () => {
    const user = await createUser({ email: 'ana@demo.local', password: PASSWORD });
    const res = await request(t.server).post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email: 'ANA@demo.local', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, email: 'ana@demo.local' });

    const cookie = sessionCookie(res)!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/Domain=/i); // sin COOKIE_DOMAIN: cookie del host
    expect(cookie).not.toMatch(/Secure/i); // solo en producción

    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(session.id).toMatch(UUID_V7_PATTERN);
    const days = (session.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(364);
    expect(days).toBeLessThanOrEqual(365);
  });

  it('login por username sin distinguir mayúsculas y get-session devuelve el usuario', async () => {
    const user = await createUser({ username: 'oscar_b', password: PASSWORD });
    const agent = request.agent(t.server);
    await agent.post('/api/auth/sign-in/username').set('Origin', ORIGIN).send({ username: 'OSCAR_B', password: PASSWORD }).expect(200);

    const res = await agent.get('/api/auth/get-session').expect(200);
    expect(res.body.user).toMatchObject({ id: user.id, username: 'oscar_b' });
    expect(res.body.session.userId).toBe(user.id);
  });

  it('contraseña incorrecta → 401 y sin cookie', async () => {
    await createUser({ email: 'malo@demo.local', password: PASSWORD });
    const res = await request(t.server).post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email: 'malo@demo.local', password: 'otra-contraseña' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_EMAIL_OR_PASSWORD');
    expect(sessionCookie(res)).toBeUndefined();
  });

  it('loginAs devuelve un agente con sesión (también para usuarios sin contraseña)', async () => {
    const user = await createUser();
    const agent = await loginAs(user, t.server);
    const res = await agent.get('/api/auth/get-session').expect(200);
    expect(res.body.user.id).toBe(user.id);
  });
});

describe('cookies entre subdominios (COOKIE_DOMAIN)', () => {
  it('con COOKIE_DOMAIN la cookie lleva ese dominio', async () => {
    const auth = createAuth({
      prisma,
      emailSender: new FakeEmailSender(),
      securityEvents: { record: () => Promise.resolve() },
      env: { NODE_ENV: 'test', APP_URL: ORIGIN, COOKIE_DOMAIN: '.hogaria.test' },
    });
    const app = express();
    app.all('/api/auth/{*splat}', toNodeHandler(auth));

    await createUser({ email: 'sub@demo.local', password: PASSWORD });
    const res = await request(app).post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email: 'sub@demo.local', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toMatch(/Domain=\.?hogaria\.test/i);
  });
});
