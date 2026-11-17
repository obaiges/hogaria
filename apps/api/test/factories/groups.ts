import { LANE_COLOR_ORDER, MAX_GROUP_MEMBERS } from '@hogaria/shared';

import { getTestPrisma } from '../utils/prisma.js';
import { createUser, type CreateUserOptions } from './users.js';

import type { Group, GroupMember, User } from '@prisma/client';

export interface CreateGroupOptions {
  name?: string;
  emoji?: string;
  /** Opciones para cada miembro creado (por posición). */
  members?: CreateUserOptions[];
}

export interface GroupWithMembers {
  group: Group;
  users: User[];
  members: GroupMember[];
}

/**
 * Crea un hogar con `n` miembros nuevos. Los colores de calle siguen
 * `LANE_COLOR_ORDER` (CORAL, SEA, SUN…), como la asignación real (docs/02).
 */
export async function createGroupWithMembers(n = 2, options: CreateGroupOptions = {}): Promise<GroupWithMembers> {
  if (n < 1 || n > MAX_GROUP_MEMBERS) throw new Error(`createGroupWithMembers: n debe estar entre 1 y ${MAX_GROUP_MEMBERS}`);
  const prisma = getTestPrisma();
  const users: User[] = [];
  for (let i = 0; i < n; i++) users.push(await createUser(options.members?.[i]));

  const group = await prisma.group.create({
    data: {
      name: options.name ?? 'Casa test',
      ...(options.emoji ? { emoji: options.emoji } : {}),
      createdById: users[0]?.id ?? null,
    },
  });
  const members: GroupMember[] = [];
  for (const [i, user] of users.entries()) {
    members.push(
      await prisma.groupMember.create({
        data: { groupId: group.id, userId: user.id, laneColor: LANE_COLOR_ORDER[i % LANE_COLOR_ORDER.length]! },
      }),
    );
  }
  return { group, users, members };
}
