import { inviteStatus, type GroupInviteDto, type GroupMemberDto, type LaneColor } from '@hogaria/shared';

import type { GroupInvite, GroupMember, User } from '@prisma/client';

export type MemberWithUser = GroupMember & { user: Pick<User, 'name' | 'username' | 'image'> };

export function toGroupMemberDto(member: MemberWithUser): GroupMemberDto {
  return {
    id: member.id,
    groupId: member.groupId,
    userId: member.userId,
    name: member.user.name,
    username: member.user.username,
    image: member.user.image,
    laneColor: member.laneColor as LaneColor,
    joinedAt: member.joinedAt.toISOString(),
  };
}

/** `names`: nombre por `userId` de quien la creó y quien la usó (una consulta por lote). */
export function toGroupInviteDto(invite: GroupInvite, names: ReadonlyMap<string, string>, now: Date = new Date()): GroupInviteDto {
  return {
    id: invite.id,
    groupId: invite.groupId,
    status: inviteStatus(invite, now),
    createdById: invite.createdById,
    createdByName: invite.createdById ? (names.get(invite.createdById) ?? null) : null,
    usedById: invite.usedById,
    usedByName: invite.usedById ? (names.get(invite.usedById) ?? null) : null,
    expiresAt: invite.expiresAt.toISOString(),
    usedAt: invite.usedAt?.toISOString() ?? null,
    revokedAt: invite.revokedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
  };
}
