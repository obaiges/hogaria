import { Controller, Get, Module } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { meDto } from '@hogaria/shared';

import { CurrentUser, Public } from '../src/common/auth/decorators.js';
import { getRequestContext } from '../src/common/context/request-context.js';
import { createUser, loginAs } from './factories/index.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';

import type { AuthUser } from '../src/common/auth/auth-user.js';

const prisma = getTestPrisma();

@Controller('guard-test')
class GuardTestController {
  /** Devuelve lo que ven el decorador y el RequestContext. */
  @Get('whoami')
  whoami(@CurrentUser() user: AuthUser) {
    const ctx = getRequestContext();
    return { user, ctx: { userId: ctx?.userId, userName: ctx?.userName, sessionId: ctx?.sessionId } };
  }

  @Public()
  @Get('open')
  open() {
    return { ok: true };
  }
}

@Module({ controllers: [GuardTestController] })
class GuardTestModule {}

describe('AuthGuard y GET /me (HOG-055)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ imports: [GuardTestModule] });
  });

  afterAll(async () => {
    await t.close();
  });

  it('sin cookie → 401 UNAUTHENTICATED en problem+json', async () => {
    const res = await request(t.server).get('/api/v1/me').expect(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });

  it('con una cookie falsa → 401', async () => {
    await request(t.server).get('/api/v1/me').set('Cookie', 'hogaria.session_token=falso.firma').expect(401);
  });

  it('con sesión → meDto válido según el esquema zod, con hasPassword y hasGoogle', async () => {
    const user = await createUser({ name: 'Ana', password: 'contraseña-larga', isPlatformAdmin: true });
    await prisma.account.create({ data: { userId: user.id, accountId: 'google-123', providerId: 'google' } });
    const agent = await loginAs(user, t.server);

    const res = await agent.get('/api/v1/me').expect(200);
    const me = meDto.parse(res.body);
    expect(me).toMatchObject({
      id: user.id,
      name: 'Ana',
      email: user.email,
      emailVerified: true,
      isPlatformAdmin: true,
      aiNoticeAcceptedAt: null,
      hasPassword: true,
      hasGoogle: true,
    });
  });

  it('sin cuenta de Google → hasGoogle false', async () => {
    const agent = await loginAs(await createUser(), t.server);
    const res = await agent.get('/api/v1/me').expect(200);
    expect(res.body).toMatchObject({ hasPassword: true, hasGoogle: false });
  });

  it('usuario bloqueado con sesión → 403 ACCOUNT_BLOCKED', async () => {
    const user = await createUser();
    const agent = await loginAs(user, t.server);
    await prisma.user.update({ where: { id: user.id }, data: { blockedAt: new Date() } });
    const res = await agent.get('/api/v1/me').expect(403);
    expect(res.body.code).toBe('ACCOUNT_BLOCKED');
  });

  it('@CurrentUser y el RequestContext reciben el usuario y la sesión', async () => {
    const user = await createUser({ name: 'Óscar' });
    const agent = await loginAs(user, t.server);
    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });

    const res = await agent.get('/api/v1/guard-test/whoami').expect(200);
    expect(res.body.user).toEqual({ id: user.id, name: 'Óscar', email: user.email, isPlatformAdmin: false, sessionId: session.id });
    expect(res.body.ctx).toEqual({ userId: user.id, userName: 'Óscar', sessionId: session.id });
  });

  it('las rutas @Public son accesibles sin cookie', async () => {
    await request(t.server).get('/api/v1/guard-test/open').expect(200, { ok: true });
    await request(t.server).get('/api/v1/health').expect(200);
  });
});

describe('throttler por usuario (HOG-014 + HOG-055)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp(); // almacén del throttler propio
  });

  afterAll(async () => {
    await t.close();
  });

  it('con sesión cuenta por usuario: agotar el límite de uno no afecta a otro ni a la IP', async () => {
    const a = await loginAs(await createUser(), t.server);
    const b = await loginAs(await createUser(), t.server);

    for (let i = 0; i < 120; i++) await a.get('/api/v1/me').expect(200);
    await a.get('/api/v1/me').expect(429);

    await b.get('/api/v1/me').expect(200);
    await request(t.server).get('/api/v1/health').expect(200);
  });
});
