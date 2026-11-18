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

import type { Group, GroupMember, LaneColor } from '@prisma/client';

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
}
