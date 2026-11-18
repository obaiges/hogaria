import { Injectable } from '@nestjs/common';

import {
  DEFAULT_EXPENSE_CATEGORIES,
  pickLaneColor,
  type CreateGroupInput,
  type GroupDto,
  type MyGroupDto,
  type UpdateGroupInput,
} from '@hogaria/shared';

import { ActivityService } from '../../activity/activity.service.js';
import { MembershipCache } from '../../common/cache/membership-cache.js';
import { AppError } from '../../common/errors/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RealtimeRooms } from '../../realtime/realtime-rooms.service.js';
import { RealtimePublisher } from '../../realtime/realtime.publisher.js';
import { GroupLifecycleHooks } from './group-lifecycle.hooks.js';
import { lockGroup } from './group-lock.js';
import { groupActivity, type GroupField } from './groups.activity.js';
import { MemberRemovedHooks } from './member-removed.hooks.js';

import type { ActivityLog, Group, GroupMember, LaneColor, Prisma } from '@prisma/client';

/** Motivo de la salida (RN-02-22). `ACCOUNT_DELETED` lo usa el borrado de cuenta (HOG-808). */
export type MemberRemovalReason = 'LEFT' | 'REMOVED' | 'ACCOUNT_DELETED';

export interface RemoveMemberOptions {
  reason: MemberRemovalReason;
  /** Quien expulsa (`REMOVED`); en el resto, el propio usuario. */
  actorId?: string;
}

/** Resultado de `removeMember`, para los pasos posteriores al commit (`afterMemberRemoved`). */
export type MemberRemoval =
  | { groupId: string; userId: string; groupDeleted: true }
  | { groupId: string; userId: string; groupDeleted: false; activityRow: ActivityLog; actorId: string; actorName: string };

/** Lista que se crea con cada hogar (RN-02-02). */
const DEFAULT_SHOPPING_LIST = { name: 'Compra', emoji: '🛒' } as const;

export function toGroupDto(group: Group): GroupDto {
  return {
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    timezone: group.timezone,
    createdById: group.createdById,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

function toMyGroupDto(group: Group, member: Pick<GroupMember, 'laneColor' | 'joinedAt'>, memberCount: number): MyGroupDto {
  return { ...toGroupDto(group), memberCount, myLaneColor: member.laneColor as LaneColor, joinedAt: member.joinedAt.toISOString() };
}

/**
 * Grupos (spec 02, RN-02-01 a RN-02-05). Patrón de mutación de docs/01: transacción →
 * commit → caché, salas y eventos → DTO.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly realtime: RealtimePublisher,
    private readonly rooms: RealtimeRooms,
    private readonly membership: MembershipCache,
    private readonly hooks: GroupLifecycleHooks,
    private readonly memberRemovedHooks: MemberRemovedHooks,
  ) {}

  /** Crea el hogar con su semilla en una sola transacción (RN-02-02). */
  async create(userId: string, input: CreateGroupInput): Promise<MyGroupDto> {
    const { group, member, activityRow } = await this.prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: { name: input.name, emoji: input.emoji, timezone: input.timezone, createdById: userId },
      });
      const member = await tx.groupMember.create({
        data: { groupId: group.id, userId, laneColor: pickLaneColor([]) },
      });
      await tx.shoppingList.create({
        data: { groupId: group.id, ...DEFAULT_SHOPPING_LIST, position: 0, createdById: userId },
      });
      await tx.expenseCategory.createMany({
        data: DEFAULT_EXPENSE_CATEGORIES.map((c, position) => ({ groupId: group.id, name: c.name, emoji: c.emoji, position })),
      });
      const activityRow = await this.activity.record(tx, {
        groupId: group.id,
        actorId: userId,
        entityType: 'group',
        entityId: group.id,
        action: 'created',
        summary: groupActivity.created(group),
      });
      return { group, member, activityRow };
    });

    // Tras el commit: el guard pudo cachear un "no miembro" y los sockets del creador
    // aún no están en la sala del grupo nuevo.
    this.membership.invalidate(userId, group.id);
    this.rooms.joinGroup(userId, group.id);
    this.activity.publishCreated(activityRow);
    return toMyGroupDto(group, member, 1);
  }

  async get(groupId: string): Promise<GroupDto> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new AppError('NOT_FOUND');
    return toGroupDto(group);
  }

  /**
   * Edita nombre, emoji o zona horaria (RN-02-03). Sin cambios reales no escribe, ni
   * genera actividad ni evento. Cambiar la zona invalida la caché del guard del grupo y
   * avisa a los módulos (RN-02-04).
   */
  async update(groupId: string, userId: string, input: UpdateGroupInput): Promise<GroupDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      if (!(await lockGroup(tx, groupId))) throw new AppError('NOT_FOUND');
      const current = await tx.group.findUniqueOrThrow({ where: { id: groupId } });

      const changed = (['name', 'emoji', 'timezone'] as const).filter(
        (field): field is GroupField => input[field] !== undefined && input[field] !== current[field],
      );
      if (changed.length === 0) return { group: current, changed, activityRow: null };

      const group = await tx.group.update({
        where: { id: groupId },
        data: Object.fromEntries(changed.map((field) => [field, input[field]])),
      });
      const activityRow = await this.activity.record(tx, {
        groupId,
        actorId: userId,
        entityType: 'group',
        entityId: groupId,
        action: 'updated',
        summary: groupActivity.updated(group, changed),
        metadata: { fields: changed },
      });
      return { group, changed, activityRow };
    });

    const dto = toGroupDto(result.group);
    if (result.activityRow) {
      if (result.changed.includes('timezone')) this.membership.invalidateGroup(groupId);
      this.realtime.publish(groupId, 'group.updated', dto);
      this.activity.publishCreated(result.activityRow);
      if (result.changed.includes('timezone')) await this.hooks.onGroupTimezoneChanged(groupId);
    }
    return dto;
  }

  /** Grupos del usuario por `joinedAt` ascendente, sin paginar (RN-02-05). */
  async listForUser(userId: string): Promise<MyGroupDto[]> {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      include: { group: { include: { _count: { select: { members: true } } } } },
    });
    return memberships.map((m) => toMyGroupDto(m.group, m, m.group._count.members));
  }

  /**
   * Saca a `userId` del grupo dentro de `tx` (RN-02-20 a RN-02-23). Acepta una transacción
   * externa para reutilizarla en el borrado de cuenta (spec 16). Si es el último miembro, borra
   * el grupo entero (RN-02-21). Tras el commit hay que llamar a `afterMemberRemoved`.
   */
  async removeMember(tx: Prisma.TransactionClient, groupId: string, userId: string, opts: RemoveMemberOptions): Promise<MemberRemoval> {
    if (!(await lockGroup(tx, groupId))) throw new AppError('NOT_FOUND');
    const member = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      include: { user: { select: { name: true } } },
    });
    if (!member) throw new AppError('NOT_FOUND');

    const others = await tx.groupMember.count({ where: { groupId, userId: { not: userId } } });
    if (others === 0) {
      // Último miembro: lo que no tiene FK a Group se borra a mano; el resto cae en cascada.
      await tx.reminder.deleteMany({ where: { groupId } });
      await tx.aiConversation.deleteMany({ where: { groupId } });
      await tx.group.delete({ where: { id: groupId } });
      return { groupId, userId, groupDeleted: true };
    }

    await this.memberRemovedHooks.run(tx, { groupId, userId });
    await tx.groupMember.delete({ where: { id: member.id } });

    const removed = opts.reason === 'REMOVED';
    const actorId = removed && opts.actorId ? opts.actorId : userId;
    const actor = removed
      ? await tx.user.findUniqueOrThrow({ where: { id: actorId }, select: { name: true } })
      : member.user;
    const activityRow = await this.activity.record(tx, {
      groupId,
      actorId,
      entityType: 'group_member',
      entityId: member.id,
      action: removed ? 'removed' : 'left',
      summary: removed ? groupActivity.memberRemoved(member.user.name) : groupActivity.memberLeft(),
      ...(removed ? { metadata: { userId } } : {}),
    });
    return { groupId, userId, groupDeleted: false, activityRow, actorId, actorName: actor.name };
  }

  /**
   * Tras el commit de `removeMember` (RN-02-20, RN-02-21): `group.member.left` **antes** de sacar
   * los sockets del usuario de la sala (así sus otros dispositivos se enteran), después las
   * salas, la caché del guard y la actividad. Si se borró el grupo, avisa a los módulos.
   */
  async afterMemberRemoved(removal: MemberRemoval): Promise<void> {
    const { groupId, userId } = removal;
    const actorId = removal.groupDeleted ? userId : removal.actorId;
    this.realtime.publish(groupId, 'group.member.left', { userId }, { actorId });
    this.rooms.leaveGroup(userId, groupId);
    if (removal.groupDeleted) {
      this.membership.invalidateGroup(groupId);
      await this.hooks.onGroupDeleted(groupId);
      return;
    }
    this.membership.invalidate(userId, groupId);
    this.activity.publishCreated(removal.activityRow, { actorName: removal.actorName });
    // E12 añadirá aquí `scheduler.cancelForUserInGroup` y `scheduler.rebuildGroup` (RN-02-22).
  }
}
