import { Injectable } from '@nestjs/common';

import { decodeCursor, encodeCursor, type ActivityDto, type ActivityQuery, type Paginated } from '@hogaria/shared';

import { AppError } from '../common/errors/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ActivityService } from './activity.service.js';

/**
 * Feed de actividad del grupo (spec 03, RN-03-30 y RN-03-31): solo lectura, por cursor sobre
 * `id` (UUIDv7, es decir, orden de creación) descendente.
 */
@Injectable()
export class ActivityFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async list(groupId: string, query: ActivityQuery): Promise<Paginated<ActivityDto>> {
    const before = query.cursor === undefined ? null : decodeCursor(query.cursor);
    if (query.cursor !== undefined && (before === null || typeof before[0] !== 'string')) {
      throw new AppError('VALIDATION_ERROR', 'Cursor no válido');
    }

    // Uno de más para saber si hay página siguiente.
    const rows = await this.prisma.activityLog.findMany({
      where: { groupId, ...(before ? { id: { lt: before[0] as string } } : {}) },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    const nextCursor = rows.length > query.limit && last ? encodeCursor([last.id]) : null;

    // `actorName` con una sola consulta por página; una cuenta borrada queda en `null` (RN-03-28).
    const actorIds = [...new Set(page.map((r) => r.actorId).filter((id): id is string => id !== null))];
    const users = actorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
      : [];
    const names = new Map(users.map((u) => [u.id, u.name]));

    return {
      items: page.map((row) => this.activity.toDto(row, row.actorId === null ? null : (names.get(row.actorId) ?? null))),
      nextCursor,
    };
  }
}
