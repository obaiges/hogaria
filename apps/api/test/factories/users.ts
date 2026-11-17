import { hashPassword } from 'better-auth/crypto';

import { getTestPrisma } from '../utils/prisma.js';

import type { User } from '@prisma/client';

export interface CreateUserOptions {
  name?: string;
  email?: string;
  username?: string;
  /** Email verificado (por defecto `true`). */
  verified?: boolean;
  /** Si se da, crea la cuenta `credential` con el hash de Better Auth. */
  password?: string;
  isPlatformAdmin?: boolean;
  blockedAt?: Date | null;
}

let seq = 0;

/** Crea un usuario único por llamada (`user1@test.local`, `user2@test.local`…). */
export async function createUser(options: CreateUserOptions = {}): Promise<User> {
  seq += 1;
  const n = `${process.pid}-${seq}`;
  const username = options.username ?? `user${n}`.replace(/-/g, '_');
  const prisma = getTestPrisma();
  const user = await prisma.user.create({
    data: {
      name: options.name ?? `Usuario ${seq}`,
      email: options.email ?? `user${n}@test.local`,
      username: username.toLowerCase(),
      displayUsername: username,
      emailVerified: options.verified ?? true,
      isPlatformAdmin: options.isPlatformAdmin ?? false,
      blockedAt: options.blockedAt ?? null,
    },
  });
  if (options.password !== undefined) {
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: 'credential',
        password: await hashPassword(options.password),
      },
    });
  }
  return user;
}
