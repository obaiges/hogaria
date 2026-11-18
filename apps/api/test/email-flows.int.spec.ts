import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { RESET_PASSWORD_SUBJECT } from '../src/auth/emails/reset-password.js';
import { VERIFY_EMAIL_SUBJECT } from '../src/auth/emails/verify-email.js';
import { EMAIL_SENDER } from '../src/email/email-sender.js';
import { createUser, inviteCookie } from './factories/index.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';

import type { EmailMessage } from '../src/email/email-sender.js';

const prisma = getTestPrisma();
const ORIGIN = 'https://hogaria.test'; // APP_URL de test/setup.ts
const PASSWORD = 'contraseña-de-prueba';
const NEW_PASSWORD = 'otra-contraseña-nueva-7';
const GENERIC_RESET = { status: true };

/** Ruta + query de un enlace absoluto del email, para pedirlo con supertest. */
const pathOf = (link: string) => {
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
};

describe('Emails de verificación y de restablecimiento (HOG-054)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(() => {
    t.emails.clear();
  });

  const post = (path: string, body: object) => request(t.server).post(`/api/auth${path}`).set('Origin', ORIGIN).send(body);
  const requestReset = (email: string) => post('/request-password-reset', { email, redirectTo: `${ORIGIN}/recuperar` });

  /** Pide el restablecimiento y devuelve el token que llega a `/recuperar?token=`. */
  async function resetToken(email: string): Promise<string> {
    await requestReset(email).expect(200);
    const mail = t.emails.last(email);
    expect(mail?.subject).toBe(RESET_PASSWORD_SUBJECT);
    const res = await request(t.server).get(pathOf(mail!.links[0]!)).expect(302);
    const location = new URL(res.headers.location as string);
    expect(`${location.origin}${location.pathname}`).toBe(`${ORIGIN}/recuperar`);
    return location.searchParams.get('token')!;
  }

  it('el registro envía el email con un enlace que verifica, crea la sesión y lleva a APP_URL/', async () => {
    await post('/sign-up/email', { name: 'Ana', email: 'ana@demo.local', username: 'ana', password: PASSWORD })
      .set('Cookie', await inviteCookie())
      .expect(200);

    const mail = t.emails.last('ana@demo.local');
    expect(mail?.subject).toBe(VERIFY_EMAIL_SUBJECT);
    expect(mail?.text).toContain('Hola, Ana. Pulsa el botón para activar tu cuenta de Hogaria.');
    const link = mail!.links[0]!;
    expect(new URL(link).searchParams.get('callbackURL')).toBe(`${ORIGIN}/`);

    const res = await request(t.server).get(pathOf(link)).expect(302);
    expect(res.headers.location).toBe(`${ORIGIN}/`);
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.some((c) => c.startsWith('hogaria.session_token='))).toBe(true);
    expect(await prisma.user.findUniqueOrThrow({ where: { email: 'ana@demo.local' } })).toMatchObject({ emailVerified: true });
  });

  it('entrar sin verificar → 403 EMAIL_NOT_VERIFIED y reenvía el email (sendOnSignIn)', async () => {
    await createUser({ email: 'sin@demo.local', password: PASSWORD, verified: false });
    const res = await post('/sign-in/email', { email: 'sin@demo.local', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(t.emails.last('sin@demo.local')?.subject).toBe(VERIFY_EMAIL_SUBJECT);
  });

  it('restablecer: email con enlace a /recuperar, PASSWORD_RESET_REQUESTED, revoca todas las sesiones y PASSWORD_CHANGED', async () => {
    const user = await createUser({ email: 'reset@demo.local', password: PASSWORD });
    const session = request.agent(t.server);
    await session.post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email: 'reset@demo.local', password: PASSWORD }).expect(200);
    await session.get('/api/v1/me').expect(200);

    const token = await resetToken('reset@demo.local');
    expect(await prisma.securityEvent.findMany({ where: { type: 'PASSWORD_RESET_REQUESTED' } })).toEqual([
      expect.objectContaining({ userId: user.id }),
    ]);
    const verification = await prisma.verification.findFirstOrThrow({ where: { identifier: `reset-password:${token}` } });
    const ttlMin = (verification.expiresAt.getTime() - Date.now()) / 60_000;
    expect(ttlMin).toBeGreaterThan(29);
    expect(ttlMin).toBeLessThanOrEqual(30);

    await post('/reset-password', { token, newPassword: NEW_PASSWORD }).expect(200);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    await session.get('/api/v1/me').expect(401);
    expect(await prisma.securityEvent.count({ where: { type: 'PASSWORD_CHANGED', userId: user.id } })).toBe(1);
    await post('/sign-in/email', { email: 'reset@demo.local', password: NEW_PASSWORD }).expect(200);
  });

  it('un token de restablecimiento ya usado → 400', async () => {
    await createUser({ email: 'reuse@demo.local', password: PASSWORD });
    const token = await resetToken('reuse@demo.local');
    await post('/reset-password', { token, newPassword: NEW_PASSWORD }).expect(200);
    const again = await post('/reset-password', { token, newPassword: 'y-otra-mas-distinta-8' });
    expect(again.status).toBe(400);
  });

  it('email inexistente → la misma respuesta, ningún email y ningún evento', async () => {
    await createUser({ email: 'existe@demo.local', password: PASSWORD });
    const existing = await requestReset('existe@demo.local').expect(200);
    t.emails.clear();

    const missing = await requestReset('nadie@demo.local').expect(200);
    expect(missing.body).toEqual(existing.body);
    expect(missing.body).toMatchObject(GENERIC_RESET);
    expect(t.emails.sent).toHaveLength(0);
    expect(await prisma.securityEvent.count({ where: { type: 'PASSWORD_RESET_REQUESTED', userId: null } })).toBe(0);
  });
});

describe('Fallo del proveedor de email (HOG-054)', () => {
  let t: TestApp;
  const failing = { send: (_: EmailMessage) => Promise.reject(new Error('Resend caído')) };

  beforeAll(async () => {
    t = await createTestApp({ overrides: [{ provide: EMAIL_SENDER, useValue: failing }] });
  });

  afterAll(async () => {
    await t.close();
  });

  it('no se revela al usuario: el restablecimiento y el registro responden lo mismo', async () => {
    await createUser({ email: 'falla@demo.local', password: PASSWORD });
    const reset = await request(t.server)
      .post('/api/auth/request-password-reset')
      .set('Origin', ORIGIN)
      .send({ email: 'falla@demo.local', redirectTo: `${ORIGIN}/recuperar` });
    expect(reset.status).toBe(200);
    expect(reset.body).toMatchObject(GENERIC_RESET);

    const signUp = await request(t.server)
      .post('/api/auth/sign-up/email')
      .set('Origin', ORIGIN)
      .set('Cookie', await inviteCookie())
      .send({ name: 'Leo', email: 'leo@demo.local', username: 'leo', password: PASSWORD });
    expect(signUp.status).toBe(200);
  });
});
