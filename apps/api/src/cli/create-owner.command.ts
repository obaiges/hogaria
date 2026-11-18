import { Prisma, type PrismaClient, type User } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

import { emailSchema, nameSchema, passwordSchema, usernameSchema } from '@hogaria/shared';
import { checkPasswordPolicy } from '@hogaria/shared/common-passwords';

import type { z } from 'zod';

/** Error esperado de la CLI: se imprime el mensaje y se sale con código ≠ 0. */
export class CliError extends Error {
  override readonly name = 'CliError';
}

export interface CreateOwnerInput {
  email: string;
  username: string;
  /** Nombre visible; si falta, el username tal como se escribió. */
  name?: string;
  password: string;
}

export const OWNER_EXISTS_MESSAGE = 'Ya existe un administrador de la plataforma';
export const EMAIL_TAKEN_MESSAGE = 'Ya existe un usuario con ese email';
export const USERNAME_TAKEN_MESSAGE = 'Ya existe un usuario con ese nombre de usuario';

function parse<T extends z.ZodType>(schema: T, value: unknown, field: string): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new CliError(`${field}: ${result.error.issues[0]?.message ?? 'no es válido'}`);
  return result.data;
}

/**
 * RN-01-30: crea el dueño de la instancia sin invitación (no pasa por Better Auth ni
 * por sus hooks): `User` con `emailVerified` e `isPlatformAdmin`, y su cuenta
 * `credential` con el hash de Better Auth, en una transacción. No crea grupos.
 */
export async function createOwner(prisma: PrismaClient, input: CreateOwnerInput): Promise<User> {
  const email = parse(emailSchema, input.email, 'Email');
  const displayUsername = parse(usernameSchema, input.username, 'Nombre de usuario');
  const username = displayUsername.toLowerCase();
  const name = parse(nameSchema, input.name ?? displayUsername, 'Nombre');
  const password = parse(passwordSchema, input.password, 'Contraseña');
  const policy = checkPasswordPolicy(password, { email, username });
  if (policy) throw new CliError(`Contraseña: ${policy}`);

  const hash = await hashPassword(password);

  try {
    return await prisma.$transaction(
      async (tx) => {
        if (await tx.user.findFirst({ where: { isPlatformAdmin: true }, select: { id: true } })) {
          throw new CliError(OWNER_EXISTS_MESSAGE);
        }
        if (await tx.user.findUnique({ where: { email }, select: { id: true } })) throw new CliError(EMAIL_TAKEN_MESSAGE);
        if (await tx.user.findUnique({ where: { username }, select: { id: true } })) throw new CliError(USERNAME_TAKEN_MESSAGE);

        const user = await tx.user.create({
          data: { email, name, username, displayUsername, emailVerified: true, isPlatformAdmin: true },
        });
        await tx.account.create({ data: { userId: user.id, accountId: user.id, providerId: 'credential', password: hash } });
        return user;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    // Otra ejecución simultánea ganó la carrera (unicidad o conflicto de serialización).
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
      throw new CliError(`${OWNER_EXISTS_MESSAGE} o el email o el nombre de usuario ya están en uso`);
    }
    throw error;
  }
}
