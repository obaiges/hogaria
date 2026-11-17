/**
 * Seed mínimo de desarrollo (HOG-013): `pnpm db:seed`.
 *
 * Crea el dueño de la instancia y un segundo usuario, y el hogar "Casa Demo" con su
 * semilla (docs/02 §Datos semilla al crear un grupo), para probar la app sin pasar por
 * invitaciones. Es idempotente. Los datos de demo de los módulos los añade HOG-865 con
 * `seedModules()` (ver el final de `runSeed`).
 *
 * Se ejecuta con Node (type stripping), sin compilar: solo importa paquetes, nunca
 * archivos .ts relativos.
 */
import 'dotenv/config';

import { pathToFileURL } from 'node:url';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Group, type User } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import pg from 'pg';

import { DEFAULT_EXPENSE_CATEGORIES, type LaneColor } from '@hogaria/shared';

/** Contraseña de los usuarios demo. No es un secreto: solo existe en BBDD locales. */
export const DEMO_PASSWORD = 'hogaria-demo-1234';

interface DemoUser {
  email: string;
  username: string;
  name: string;
  isPlatformAdmin: boolean;
  laneColor: LaneColor;
}

export const DEMO_USERS: readonly DemoUser[] = [
  { email: 'ana@demo.local', username: 'ana', name: 'Ana', isPlatformAdmin: true, laneColor: 'CORAL' },
  { email: 'oscar@demo.local', username: 'oscar', name: 'Óscar', isPlatformAdmin: false, laneColor: 'SEA' },
];

export const DEMO_GROUP = { name: 'Casa Demo', emoji: '🏠' } as const;
const DEFAULT_LIST = { name: 'Compra', emoji: '🛒', position: 0 } as const;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'db', 'db-test', 'postgres']);

/**
 * El seed crea usuarios con una contraseña conocida: nunca en producción ni contra una
 * BBDD remota (p. ej. Neon) salvo que se pida explícitamente con `SEED_ALLOW_REMOTE=true`.
 */
export function assertSeedAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === 'production') {
    throw new Error('El seed de desarrollo no se ejecuta con NODE_ENV=production');
  }
  const url = env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL es obligatoria para el seed');
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('DATABASE_URL no es una URL de Postgres válida');
  }
  if (!LOCAL_HOSTS.has(host) && env.SEED_ALLOW_REMOTE !== 'true') {
    throw new Error(`El seed solo se ejecuta contra una BBDD local (host: ${host}). Usa SEED_ALLOW_REMOTE=true si de verdad quieres sembrar una remota.`);
  }
}

export async function seedUsers(prisma: PrismaClient): Promise<User[]> {
  const users: User[] = [];
  for (const demo of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: {},
      create: {
        email: demo.email,
        name: demo.name,
        username: demo.username,
        displayUsername: demo.username,
        emailVerified: true,
        isPlatformAdmin: demo.isPlatformAdmin,
      },
    });
    const hasCredential = await prisma.account.findFirst({ where: { userId: user.id, providerId: 'credential' } });
    if (!hasCredential) {
      await prisma.account.create({
        data: { userId: user.id, accountId: user.id, providerId: 'credential', password: await hashPassword(DEMO_PASSWORD) },
      });
    }
    users.push(user);
  }
  return users;
}

export async function seedGroup(prisma: PrismaClient, users: User[]): Promise<Group> {
  const owner = users[0];
  if (!owner) throw new Error('seedGroup necesita al menos un usuario');

  const group =
    (await prisma.group.findFirst({ where: { name: DEMO_GROUP.name, createdById: owner.id } })) ??
    (await prisma.group.create({ data: { name: DEMO_GROUP.name, emoji: DEMO_GROUP.emoji, createdById: owner.id } }));

  for (const [i, user] of users.entries()) {
    const laneColor = DEMO_USERS[i]?.laneColor ?? 'SLATE';
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: user.id } },
      update: {},
      create: { groupId: group.id, userId: user.id, laneColor },
    });
  }

  const list = await prisma.shoppingList.findFirst({ where: { groupId: group.id, name: DEFAULT_LIST.name } });
  if (!list) {
    await prisma.shoppingList.create({ data: { groupId: group.id, createdById: owner.id, ...DEFAULT_LIST } });
  }

  for (const [position, category] of DEFAULT_EXPENSE_CATEGORIES.entries()) {
    await prisma.expenseCategory.upsert({
      where: { groupId_name: { groupId: group.id, name: category.name } },
      update: {},
      create: { groupId: group.id, name: category.name, emoji: category.emoji, position },
    });
  }
  return group;
}

export async function runSeed(prisma: PrismaClient): Promise<{ users: User[]; group: Group }> {
  const users = await seedUsers(prisma);
  const group = await seedGroup(prisma, users);
  // HOG-865: await seedModules(prisma, { users, group });
  return { users, group };
}

async function main(): Promise<void> {
  assertSeedAllowed();
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const { users, group } = await runSeed(prisma);
    process.stdout.write(`Seed listo: ${users.map((u) => u.email).join(', ')} en "${group.name}" (contraseña: ${DEMO_PASSWORD})\n`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
