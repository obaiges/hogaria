import { hashPassword } from 'better-auth/crypto';
import request from 'supertest';

import { getTestPrisma } from '../utils/prisma.js';
import { knownPasswords } from './users.js';

import type { User } from '@prisma/client';

export type SessionAgent = ReturnType<typeof request.agent>;

/** Contraseña que `loginAs` pone a los usuarios creados sin ella. */
export const LOGIN_AS_PASSWORD = 'hogaria-login-as-1234';

/** Origen de la web en los tests (`APP_URL` de test/setup.ts), confiable para Better Auth. */
const TEST_ORIGIN = 'https://hogaria.test';

/**
 * Agente de supertest con la cookie de sesión de `user`, tras un login real por email
 * en Better Auth (`POST /api/auth/sign-in/email`). El usuario debe tener el email
 * verificado (la factory lo crea así por defecto). Si se creó sin contraseña, se le
 * añade la cuenta `credential` con `LOGIN_AS_PASSWORD`.
 *
 * ```ts
 * const t = await createTestApp();
 * const agent = await loginAs(await createUser(), t.server);
 * await agent.get('/api/v1/me').expect(200);
 * ```
 */
export async function loginAs(user: User, server: Parameters<typeof request.agent>[0]): Promise<SessionAgent> {
  return (await signIn(user, server)).agent;
}

/**
 * Cabecera `Cookie` con la sesión de `user` (login real, como `loginAs`). Para clientes
 * que no son supertest, como `socket.io-client`.
 */
export async function sessionCookieFor(user: User, server: Parameters<typeof request.agent>[0]): Promise<string> {
  const { res } = await signIn(user, server);
  const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
  return (setCookie ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function signIn(user: User, server: Parameters<typeof request.agent>[0]) {
  let password = knownPasswords.get(user.id);
  if (!password) {
    password = LOGIN_AS_PASSWORD;
    const prisma = getTestPrisma();
    const hash = await hashPassword(password);
    const credential = await prisma.account.findFirst({ where: { userId: user.id, providerId: 'credential' } });
    if (credential) await prisma.account.update({ where: { id: credential.id }, data: { password: hash } });
    else await prisma.account.create({ data: { userId: user.id, accountId: user.id, providerId: 'credential', password: hash } });
    knownPasswords.set(user.id, password);
  }

  const agent = request.agent(server);
  const res = await agent.post('/api/auth/sign-in/email').set('Origin', TEST_ORIGIN).send({ email: user.email, password });
  if (res.status !== 200) {
    throw new Error(`loginAs(${user.email}) falló: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { agent, res };
}
