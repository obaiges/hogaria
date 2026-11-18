import { createHash, randomBytes } from 'node:crypto';

import { INVITE_TTL_DAYS } from '@hogaria/shared';

import { getTestPrisma } from '../utils/prisma.js';

import type { GroupInvite } from '@prisma/client';

export type InviteStatus = 'active' | 'used' | 'revoked' | 'expired';

export interface CreateInviteOptions {
  status?: InviteStatus;
  createdById?: string | null;
  /** Para `status: 'used'`: quién la usó. */
  usedById?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Igual que la API: en BBDD solo se guarda el SHA-256 del token (docs/02, `tokenHash`). */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Crea una invitación y devuelve también el token en claro (el que iría en el enlace). */
export async function createInvite(
  groupId: string,
  options: CreateInviteOptions = {},
): Promise<{ invite: GroupInvite; token: string }> {
  const status = options.status ?? 'active';
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  const invite = await getTestPrisma().groupInvite.create({
    data: {
      groupId,
      createdById: options.createdById ?? null,
      tokenHash: hashInviteToken(token),
      expiresAt: new Date(status === 'expired' ? now - DAY_MS : now + INVITE_TTL_DAYS * DAY_MS),
      usedAt: status === 'used' ? new Date(now) : null,
      usedById: status === 'used' ? (options.usedById ?? null) : null,
      revokedAt: status === 'revoked' ? new Date(now) : null,
    },
  });
  return { invite, token };
}

/**
 * Cabecera `Cookie` con una invitación activa nueva (`hogaria_invite`), como la que pone
 * `GET /invites/:token`. Para registrar usuarios en los tests (RN-01-01). Si no se pasa
 * `groupId`, crea un hogar de un miembro.
 */
export async function inviteCookie(groupId?: string): Promise<string> {
  const { createGroupWithMembers } = await import('./groups.js');
  const target = groupId ?? (await createGroupWithMembers(1)).group.id;
  const { token } = await createInvite(target);
  return `hogaria_invite=${token}`;
}
