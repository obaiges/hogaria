import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromNodeHeaders } from 'better-auth/node';

import {
  INVITE_TTL_DAYS,
  MAX_ACTIVE_INVITES_PER_GROUP,
  MAX_GROUP_MEMBERS,
  pickLaneColor,
  type AcceptInviteResultDto,
  type CreatedGroupInviteDto,
  type GroupInviteDto,
  type LaneColor,
  type PublicInviteDto,
} from '@hogaria/shared';

import { ActivityService } from '../../activity/activity.service.js';
import { AUTH, type Auth } from '../../auth/auth.js';
import { SignupInviteConsumerRef } from '../../auth/invite-hooks.js';
import { MembershipCache } from '../../common/cache/membership-cache.js';
import { AppError } from '../../common/errors/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RealtimeRooms } from '../../realtime/realtime-rooms.service.js';
import { RealtimePublisher } from '../../realtime/realtime.publisher.js';
import { lockGroup } from './group-lock.js';
import { toGroupInviteDto, toGroupMemberDto, type MemberWithUser } from './group-mappers.js';
import { groupActivity } from './groups.activity.js';
import { generateInviteToken, hashInviteToken } from './invite-token.js';

import type { ActivityLog, GroupInvite, Prisma } from '@prisma/client';
import type { IncomingHttpHeaders } from 'node:http';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Las no activas se listan durante 30 días (RN-02-14). */
const INACTIVE_LIST_DAYS = 30;

const MSG_GROUP_FULL = `Este hogar ya tiene el máximo de ${MAX_GROUP_MEMBERS} miembros`;
const MSG_TOO_MANY_INVITES = 'Hay demasiadas invitaciones pendientes. Revoca alguna';
const MSG_NOT_ACTIVE = 'Esta invitación ya no está activa';

/** Condición de invitación `ACTIVE` en `now` (RN-02-13). */
const activeWhere = (now: Date) => ({ usedAt: null, revokedAt: null, expiresAt: { gt: now } });

type ConsumeResult =
  | { alreadyMember: true; groupId: string }
  | { alreadyMember: false; groupId: string; member: MemberWithUser; invite: GroupInvite; activityRow: ActivityLog };

/**
 * Invitaciones de un solo uso (spec 02, RN-02-10 a RN-02-19). Solo se guarda el SHA-256
 * del token; el token en claro solo sale en la respuesta de `create`.
 */
@Injectable()
export class InvitesService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly realtime: RealtimePublisher,
    private readonly rooms: RealtimeRooms,
    private readonly membership: MembershipCache,
    private readonly config: ConfigService,
    @Inject(AUTH) private readonly auth: Auth,
    private readonly signupConsumer: SignupInviteConsumerRef,
  ) {}

  /** El registro de Better Auth (hook `user.create.after`) consume con este servicio. */
  onModuleInit(): void {
    this.signupConsumer.set(this);
  }

  /** `POST /groups/:groupId/invites` (RN-02-10 a RN-02-12). */
  async create(groupId: string, user: { id: string; name: string }): Promise<CreatedGroupInviteDto> {
    const token = generateInviteToken();
    const now = new Date();
    const { invite, activityRow } = await this.prisma.$transaction(async (tx) => {
      if (!(await lockGroup(tx, groupId))) throw new AppError('NOT_FOUND');
      if ((await tx.groupMember.count({ where: { groupId } })) >= MAX_GROUP_MEMBERS) throw new AppError('CONFLICT', MSG_GROUP_FULL);
      if ((await tx.groupInvite.count({ where: { groupId, ...activeWhere(now) } })) >= MAX_ACTIVE_INVITES_PER_GROUP) {
        throw new AppError('CONFLICT', MSG_TOO_MANY_INVITES);
      }
      const invite = await tx.groupInvite.create({
        data: { groupId, createdById: user.id, tokenHash: hashInviteToken(token), expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS) },
      });
      const activityRow = await this.activity.record(tx, {
        groupId,
        actorId: user.id,
        entityType: 'group_invite',
        entityId: invite.id,
        action: 'created',
        summary: groupActivity.inviteCreated(),
      });
      return { invite, activityRow };
    });

    const dto = toGroupInviteDto(invite, new Map([[user.id, user.name]]));
    this.realtime.publish(groupId, 'invite.created', dto);
    this.activity.publishCreated(activityRow);
    return { invite: dto, token, url: `${this.appUrl()}/invite/${token}` };
  }

  /** `GET /groups/:groupId/invites`: las activas y las demás de los últimos 30 días (RN-02-14). */
  async list(groupId: string): Promise<GroupInviteDto[]> {
    const now = new Date();
    const invites = await this.prisma.groupInvite.findMany({
      where: { groupId, OR: [activeWhere(now), { createdAt: { gte: new Date(now.getTime() - INACTIVE_LIST_DAYS * DAY_MS) } }] },
      orderBy: { createdAt: 'desc' },
    });
    const names = await this.namesOf(invites.flatMap((i) => [i.createdById, i.usedById]));
    return invites.map((i) => toGroupInviteDto(i, names, now));
  }

  /** `DELETE /groups/:groupId/invites/:inviteId`: solo las `ACTIVE` (RN-02-15). */
  async revoke(groupId: string, inviteId: string, userId: string): Promise<GroupInviteDto> {
    const now = new Date();
    const { invite, activityRow } = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.groupInvite.updateMany({ where: { id: inviteId, groupId, ...activeWhere(now) }, data: { revokedAt: now } });
      if (count !== 1) {
        const exists = await tx.groupInvite.findFirst({ where: { id: inviteId, groupId }, select: { id: true } });
        throw exists ? new AppError('CONFLICT', MSG_NOT_ACTIVE) : new AppError('NOT_FOUND');
      }
      const invite = await tx.groupInvite.findUniqueOrThrow({ where: { id: inviteId } });
      const activityRow = await this.activity.record(tx, {
        groupId,
        actorId: userId,
        entityType: 'group_invite',
        entityId: inviteId,
        action: 'revoked',
        summary: groupActivity.inviteRevoked(),
      });
      return { invite, activityRow };
    });

    const dto = toGroupInviteDto(invite, await this.namesOf([invite.createdById, invite.usedById]), now);
    this.realtime.publish(groupId, 'invite.revoked', dto);
    this.activity.publishCreated(activityRow);
    return dto;
  }

  /**
   * `GET /invites/:token` (público, RN-02-16). `setCookie` indica si hay que poner la
   * cookie `hogaria_invite` (invitación activa y petición sin sesión).
   */
  async getPublic(token: string, headers: IncomingHttpHeaders): Promise<{ dto: PublicInviteDto; setCookie: boolean }> {
    const invite = await this.prisma.groupInvite.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      include: { group: { select: { id: true, name: true, emoji: true } } },
    });
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(headers) }).catch(() => null);
    const base = async (i: NonNullable<typeof invite>) => ({
      groupName: i.group.name,
      groupEmoji: i.group.emoji,
      invitedByName: (await this.namesOf([i.createdById])).get(i.createdById ?? '') ?? null,
      expiresAt: i.expiresAt.toISOString(),
    });

    if (invite && session) {
      const member = await this.prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: invite.groupId, userId: session.user.id } },
        select: { id: true },
      });
      if (member) return { dto: { ...(await base(invite)), alreadyMember: true, groupId: invite.groupId }, setCookie: false };
    }
    if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt <= new Date()) throw new AppError('INVITE_INVALID');
    return { dto: { ...(await base(invite)), alreadyMember: false, groupId: null }, setCookie: !session };
  }

  /** `POST /invites/:token/accept` con sesión (RN-02-17 y RN-02-18). */
  async accept(token: string, userId: string): Promise<AcceptInviteResultDto> {
    return this.consumeAndPublish(token, userId);
  }

  /**
   * Para el hook de registro de Better Auth (spec 01, RN-01-04): mismo consumo que
   * `accept`, para el usuario recién creado.
   */
  async consumeForNewUser(token: string, userId: string): Promise<AcceptInviteResultDto> {
    return this.consumeAndPublish(token, userId);
  }

  private async consumeAndPublish(token: string, userId: string): Promise<AcceptInviteResultDto> {
    const result = await this.prisma.$transaction((tx) => this.consumeInvite(tx, hashInviteToken(token), userId));
    if (result.alreadyMember) return { groupId: result.groupId, alreadyMember: true };

    // Tras el commit (RN-02-18). El actor es el nuevo miembro también en el registro,
    // donde la petición aún no tiene usuario en el RequestContext.
    const { groupId, member, invite, activityRow } = result;
    this.membership.invalidate(userId, groupId);
    this.rooms.joinGroup(userId, groupId);
    const names = await this.namesOf([invite.createdById, invite.usedById]);
    this.realtime.publish(groupId, 'group.member.joined', toGroupMemberDto(member), { actorId: userId });
    this.realtime.publish(groupId, 'invite.used', toGroupInviteDto(invite, names), { actorId: userId });
    this.activity.publishCreated(activityRow, { actorName: member.user.name });
    // E12 añadirá aquí `scheduler.rebuildGroup(groupId)` (RN-02-17).
    return { groupId, alreadyMember: false };
  }

  /**
   * Consumo atómico (RN-02-17), dentro de la transacción `tx`: bloquea el grupo; si ya es
   * miembro, termina sin consumir; comprueba el máximo; consume con `updateMany` (si no
   * cambia exactamente una fila, `410`); crea el miembro con su color y la actividad.
   */
  async consumeInvite(tx: Prisma.TransactionClient, tokenHash: string, userId: string): Promise<ConsumeResult> {
    const found = await tx.groupInvite.findUnique({ where: { tokenHash }, select: { id: true, groupId: true } });
    if (!found || !(await lockGroup(tx, found.groupId))) throw new AppError('INVITE_INVALID');
    const { groupId } = found;

    const members = await tx.groupMember.findMany({ where: { groupId }, select: { userId: true, laneColor: true } });
    if (members.some((m) => m.userId === userId)) return { alreadyMember: true, groupId };
    if (members.length >= MAX_GROUP_MEMBERS) throw new AppError('CONFLICT', MSG_GROUP_FULL);

    const now = new Date();
    const { count } = await tx.groupInvite.updateMany({ where: { id: found.id, ...activeWhere(now) }, data: { usedAt: now, usedById: userId } });
    if (count !== 1) throw new AppError('INVITE_INVALID');

    const member = await tx.groupMember.create({
      data: { groupId, userId, laneColor: pickLaneColor(members.map((m) => m.laneColor as LaneColor)) },
      include: { user: { select: { name: true, username: true, image: true } } },
    });
    const invite = await tx.groupInvite.findUniqueOrThrow({ where: { id: found.id } });
    const activityRow = await this.activity.record(tx, {
      groupId,
      actorId: userId,
      entityType: 'group_member',
      entityId: member.id,
      action: 'joined',
      summary: groupActivity.memberJoined(),
    });
    return { alreadyMember: false, groupId, member, invite, activityRow };
  }

  private appUrl(): string {
    return (this.config.get<string>('APP_URL') ?? '').replace(/\/+$/, '');
  }

  /** Nombres de usuario por id, en una sola consulta. */
  private async namesOf(ids: Array<string | null>): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => id !== null))];
    if (unique.length === 0) return new Map();
    const users = await this.prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
    return new Map(users.map((u) => [u.id, u.name]));
  }
}
