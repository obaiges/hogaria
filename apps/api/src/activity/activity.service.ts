import { Injectable } from '@nestjs/common';

import {
  ACTIVITY_SUMMARY_MAX,
  isActivityAction,
  isActivityEntityType,
  type ActivityAction,
  type ActivityDto,
  type ActivityEntityType,
} from '@hogaria/shared';

import { getRequestContext } from '../common/context/request-context.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';
import { truncateText } from './summary.js';

import type { ActivityLog, Prisma } from '@prisma/client';

export interface RecordActivityInput {
  groupId: string;
  /** `null` = sistema (scheduler). */
  actorId: string | null;
  entityType: ActivityEntityType;
  entityId: string;
  action: ActivityAction;
  /** Ver `summary.ts` (RN-03-27). Se recorta a 200 caracteres. */
  summary: string;
  metadata?: Record<string, unknown>;
}

/**
 * Registro de actividad del grupo (spec 03, RN-03-25 y RN-03-26). Patrón de uso:
 *
 * ```ts
 * const row = await this.prisma.$transaction(async (tx) => {
 *   const item = await tx.shoppingItem.create(…);
 *   const activity = await this.activity.record(tx, { groupId, actorId: user.id, entityType: 'shopping_item', … });
 *   return activity;
 * });
 * this.realtime.publish(groupId, 'shopping.item.created', dto);
 * this.activity.publishCreated(row);   // después del commit
 * ```
 */
@Injectable()
export class ActivityService {
  constructor(private readonly realtime: RealtimePublisher) {}

  /**
   * Escribe la entrada **dentro** de la transacción de la mutación (`tx`); nunca abre la suya.
   * Si la transacción se deshace, la actividad también. Devuelve la fila creada.
   */
  async record(tx: Prisma.TransactionClient, input: RecordActivityInput): Promise<ActivityLog> {
    if (!isActivityEntityType(input.entityType)) throw new Error(`ActivityService: entityType desconocido "${String(input.entityType)}"`);
    if (!isActivityAction(input.action)) throw new Error(`ActivityService: action desconocida "${String(input.action)}"`);

    return tx.activityLog.create({
      data: {
        groupId: input.groupId,
        actorId: input.actorId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        summary: truncateText(input.summary, ACTIVITY_SUMMARY_MAX),
        ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonObject } : {}),
      },
    });
  }

  /**
   * Publica `activity.created` en el grupo. Llamar **después del commit**. Sin consultas:
   * `actorName` sale del `RequestContext` si el actor es el usuario de la petición.
   */
  publishCreated(row: ActivityLog): void {
    this.realtime.publish(row.groupId, 'activity.created', this.toDto(row));
  }

  /** `ActivityDto` de una fila; `actorName` del `RequestContext` (o `null`). */
  toDto(row: ActivityLog, actorName: string | null = this.contextActorName(row.actorId)): ActivityDto {
    return {
      id: row.id,
      groupId: row.groupId,
      actorId: row.actorId,
      actorName: row.actorId === null ? null : actorName,
      entityType: row.entityType as ActivityEntityType,
      entityId: row.entityId,
      action: row.action as ActivityAction,
      summary: row.summary,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private contextActorName(actorId: string | null): string | null {
    const ctx = getRequestContext();
    return actorId !== null && ctx?.userId === actorId ? ctx.userName : null;
  }
}
