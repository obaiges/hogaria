import { verifyPassword } from 'better-auth/crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createGroupWithMembers, createInvite, createUser, hashInviteToken } from './factories/index.js';
import { FakeEmailSender, FakeGeminiClient, FakeWebPushSender } from './fakes/index.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';
import { assertTestDatabase } from './utils/test-db.js';

const prisma = getTestPrisma();

describe('infraestructura de tests (HOG-010)', () => {
  describe('truncado entre tests', () => {
    // El orden importa: el segundo test comprueba que el primero no deja datos.
    it('la factory crea un usuario', async () => {
      const user = await createUser({ name: 'Ana' });
      expect(user).toMatchObject({ name: 'Ana', emailVerified: true, isPlatformAdmin: false, blockedAt: null });
      expect(await prisma.user.count()).toBe(1);
    });

    it('cada test empieza con la BBDD vacía', async () => {
      expect(await prisma.user.count()).toBe(0);
      expect(await prisma.group.count()).toBe(0);
    });
  });

  describe('factories', () => {
    it('createUser con contraseña crea la cuenta credential con el hash de Better Auth', async () => {
      const user = await createUser({ password: 'hogaria-1234', verified: false, isPlatformAdmin: true, blockedAt: new Date() });
      expect(user.emailVerified).toBe(false);
      expect(user.isPlatformAdmin).toBe(true);
      expect(user.blockedAt).toBeInstanceOf(Date);
      const account = await prisma.account.findFirstOrThrow({ where: { userId: user.id } });
      expect(account.providerId).toBe('credential');
      await expect(verifyPassword({ hash: account.password!, password: 'hogaria-1234' })).resolves.toBe(true);
    });

    it('createGroupWithMembers asigna los colores de calle en orden', async () => {
      const { group, users, members } = await createGroupWithMembers(3, { name: 'Casa Baiges' });
      expect(group).toMatchObject({ name: 'Casa Baiges', emoji: '🏠', timezone: 'Europe/Madrid', createdById: users[0]!.id });
      expect(members.map((m) => m.laneColor)).toEqual(['CORAL', 'SEA', 'SUN']);
      expect(new Set(users.map((u) => u.email)).size).toBe(3);
    });

    it('createInvite guarda solo el hash del token y respeta el estado', async () => {
      const { group, users } = await createGroupWithMembers(1);
      const { invite, token } = await createInvite(group.id, { createdById: users[0]!.id });
      expect(invite.tokenHash).toBe(hashInviteToken(token));
      expect(invite.tokenHash).not.toContain(token);
      expect(invite.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const expired = await createInvite(group.id, { status: 'expired' });
      expect(expired.invite.expiresAt.getTime()).toBeLessThan(Date.now());
      const used = await createInvite(group.id, { status: 'used', usedById: users[0]!.id });
      expect(used.invite.usedAt).toBeInstanceOf(Date);
      const revoked = await createInvite(group.id, { status: 'revoked' });
      expect(revoked.invite.revokedAt).toBeInstanceOf(Date);
    });

  });

  describe('createTestApp', () => {
    let t: TestApp;

    beforeAll(async () => {
      t = await createTestApp();
    });

    afterAll(async () => {
      await t.close();
    });

    it('arranca la API real con los fakes de los servicios externos', async () => {
      expect(t.emails).toBeInstanceOf(FakeEmailSender);
      expect(t.push).toBeInstanceOf(FakeWebPushSender);
      expect(t.gemini).toBeInstanceOf(FakeGeminiClient);
      await request(t.server).get('/api/v1/health').expect(200, { status: 'ok' });
      await request(t.server).get('/api/v1/health/db').expect(200, { status: 'ok' });
    });
  });

  it('solo acepta BBDD *_test', () => {
    expect(() => assertTestDatabase('postgresql://u:p@localhost:5432/hogaria')).toThrow(/_test/);
    expect(() => assertTestDatabase('no es una url')).toThrow(/válida/);
    expect(() => assertTestDatabase('postgresql://u:p@localhost:5433/hogaria_test')).not.toThrow();
  });
});
