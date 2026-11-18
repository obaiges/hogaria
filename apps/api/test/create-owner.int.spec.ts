import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CliError, createOwner, EMAIL_TAKEN_MESSAGE, OWNER_EXISTS_MESSAGE, USERNAME_TAKEN_MESSAGE } from '../src/cli/create-owner.command.js';
import { createUser } from './factories/index.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';

const prisma = getTestPrisma();
const ORIGIN = 'https://hogaria.test';
const PASSWORD = 'piscina-municipal-2026';

describe('CLI create-owner (HOG-057, RN-01-30)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('crea el administrador verificado, sin grupos, que puede entrar con email y con username', async () => {
    const user = await createOwner(prisma, { email: ' Ana@Demo.Local ', username: 'Ana_G', password: PASSWORD });

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { accounts: true, memberships: true } });
    expect(stored).toMatchObject({
      email: 'ana@demo.local',
      username: 'ana_g',
      displayUsername: 'Ana_G',
      name: 'Ana_G',
      emailVerified: true,
      isPlatformAdmin: true,
    });
    expect(stored.accounts).toEqual([expect.objectContaining({ providerId: 'credential', accountId: user.id })]);
    expect(stored.accounts[0]!.password).not.toContain(PASSWORD);
    expect(stored.memberships).toHaveLength(0);
    expect(await prisma.groupInvite.count()).toBe(0);

    const byEmail = request.agent(t.server);
    await byEmail.post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email: 'ana@demo.local', password: PASSWORD }).expect(200);
    const me = await byEmail.get('/api/v1/me').expect(200);
    expect(me.body).toMatchObject({ id: user.id, isPlatformAdmin: true });

    await request(t.server).post('/api/auth/sign-in/username').set('Origin', ORIGIN).send({ username: 'ANA_G', password: PASSWORD }).expect(200);
  });

  it('usa --name como nombre visible', async () => {
    const user = await createOwner(prisma, { email: 'ana@demo.local', username: 'ana', name: '  Ana García ', password: PASSWORD });
    expect(user.name).toBe('Ana García');
  });

  it('una segunda ejecución falla: ya existe un administrador', async () => {
    await createOwner(prisma, { email: 'ana@demo.local', username: 'ana', password: PASSWORD });
    await expect(createOwner(prisma, { email: 'otro@demo.local', username: 'otro', password: PASSWORD })).rejects.toThrow(
      new CliError(OWNER_EXISTS_MESSAGE),
    );
    expect(await prisma.user.count()).toBe(1);
  });

  it('falla si el email o el username ya existen', async () => {
    await createUser({ email: 'ana@demo.local', username: 'ana' });
    await expect(createOwner(prisma, { email: 'ANA@demo.local', username: 'nueva', password: PASSWORD })).rejects.toThrow(
      new CliError(EMAIL_TAKEN_MESSAGE),
    );
    await expect(createOwner(prisma, { email: 'nueva@demo.local', username: 'Ana', password: PASSWORD })).rejects.toThrow(
      new CliError(USERNAME_TAKEN_MESSAGE),
    );
    expect(await prisma.user.count({ where: { isPlatformAdmin: true } })).toBe(0);
  });

  it('rechaza una contraseña común, corta o que contiene el username (RN-01-10)', async () => {
    await expect(createOwner(prisma, { email: 'ana@demo.local', username: 'ana', password: '1234567890' })).rejects.toThrow(/demasiado común/);
    await expect(createOwner(prisma, { email: 'ana@demo.local', username: 'ana', password: 'corta' })).rejects.toThrow(/al menos/);
    await expect(createOwner(prisma, { email: 'ana@demo.local', username: 'socorrista', password: 'socorrista-2026' })).rejects.toThrow(/nombre de usuario/);
    expect(await prisma.user.count()).toBe(0);
  });

  it('valida el email y el username con los esquemas de shared', async () => {
    await expect(createOwner(prisma, { email: 'no-es-email', username: 'ana', password: PASSWORD })).rejects.toThrow(/^Email:/);
    await expect(createOwner(prisma, { email: 'ana@demo.local', username: '.mal', password: PASSWORD })).rejects.toThrow(/^Nombre de usuario:/);
  });
});
