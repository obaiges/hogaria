import { Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RealtimePublisher } from '../../realtime/realtime.publisher.js';
import { lockGroup } from './group-lock.js';
import { toGroupMemberDto } from './group-mappers.js';

import type { GroupMemberDto, UpdateMyMemberInput } from '@hogaria/shared';

const MEMBER_USER = { user: { select: { name: true, username: true, image: true } } } as const;

/** Miembros de un grupo (spec 02 §5): listar y cambiar el propio color de calle. */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimePublisher,
  ) {}

  /** Miembros por `joinedAt` ascendente. */
  async list(groupId: string): Promise<GroupMemberDto[]> {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      include: MEMBER_USER,
    });
    return members.map(toGroupMemberDto);
  }

  /**
   * RN-02-09: solo el propio color, con el grupo bloqueado (RN-02-08) para que dos
   * cambios simultáneos al mismo color no acaben repetidos. Mismo color → sin evento.
   * El cambio de color no escribe actividad.
   */
  async updateMine(groupId: string, userId: string, input: UpdateMyMemberInput): Promise<GroupMemberDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      if (!(await lockGroup(tx, groupId))) throw new AppError('NOT_FOUND');
      const me = await tx.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, include: MEMBER_USER });
      if (!me) throw new AppError('NOT_FOUND');
      if (me.laneColor === input.laneColor) return { member: me, changed: false };

      const holder = await tx.groupMember.findFirst({
        where: { groupId, laneColor: input.laneColor, userId: { not: userId } },
        include: MEMBER_USER,
      });
      if (holder) throw new AppError('CONFLICT', `Ese color ya lo tiene ${holder.user.name}`);

      const member = await tx.groupMember.update({ where: { id: me.id }, data: { laneColor: input.laneColor }, include: MEMBER_USER });
      return { member, changed: true };
    });

    const dto = toGroupMemberDto(result.member);
    if (result.changed) this.realtime.publish(groupId, 'group.member.updated', dto);
    return dto;
  }
}
