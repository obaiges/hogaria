import { request, type APIRequestContext } from '@playwright/test';

import { E2E_API_URL, E2E_WEB_URL } from './env';

/** Lo que devuelve `POST /api/v1/test/users` (apps/api/src/test-support). */
export interface TestUser {
  userId: string;
  name: string;
  email: string;
  username: string;
  password: string;
  groupId: string | null;
  laneColor: string | null;
}

export interface CreateUserOptions {
  name?: string;
  email?: string;
  username?: string;
  password?: string;
  isPlatformAdmin?: boolean;
  /** Crea un hogar nuevo con este usuario. */
  group?: { name?: string };
  /** Le une a un hogar existente. */
  joinGroupId?: string;
}

interface SentEmail {
  to: string;
  subject: string;
  links: string[];
}

let api: APIRequestContext | undefined;

async function apiContext(): Promise<APIRequestContext> {
  api ??= await request.newContext({ baseURL: E2E_API_URL });
  return api;
}

async function ok<T>(res: Awaited<ReturnType<APIRequestContext['get']>>, what: string): Promise<T> {
  if (!res.ok()) throw new Error(`${what}: ${res.status()} ${await res.text()}`);
  return (res.status() === 204 ? undefined : await res.json()) as T;
}

/** Vacía la BBDD de test y los emails (`POST /api/v1/test/reset`). */
export async function resetDb(): Promise<void> {
  const ctx = await apiContext();
  await ok(await ctx.post('/api/v1/test/reset'), 'resetDb');
}

/** Usuario verificado con contraseña y, opcionalmente, un hogar (`POST /api/v1/test/users`). */
export async function createUser(options: CreateUserOptions = {}): Promise<TestUser> {
  const ctx = await apiContext();
  return ok<TestUser>(await ctx.post('/api/v1/test/users', { data: options }), 'createUser');
}

/** Primer enlace del último email enviado a `to` (verificación, recuperar contraseña…). */
export async function lastEmailLink(to: string): Promise<string> {
  const ctx = await apiContext();
  const emails = await ok<SentEmail[]>(await ctx.get('/api/v1/test/emails', { params: { to } }), 'lastEmailLink');
  const last = emails[emails.length - 1];
  const link = last?.links[0];
  if (!link) throw new Error(`No hay emails con enlaces para ${to}`);
  return link;
}

/**
 * Invitación al hogar de `user` (`POST /api/v1/groups/:g/invites`) creada con su propia
 * sesión en un contexto aparte. Devuelve el enlace en claro (solo se ve al crearla).
 */
export async function createInvite(user: TestUser): Promise<{ token: string; url: string }> {
  if (!user.groupId) throw new Error(`createInvite: ${user.email} no tiene hogar`);
  const ctx = await request.newContext({ baseURL: E2E_API_URL, extraHTTPHeaders: { Origin: E2E_WEB_URL } });
  try {
    await ok(await ctx.post('/api/auth/sign-in/email', { data: { email: user.email, password: user.password } }), 'createInvite (login)');
    return await ok<{ token: string; url: string }>(await ctx.post(`/api/v1/groups/${user.groupId}/invites`), 'createInvite');
  } finally {
    await ctx.dispose();
  }
}
