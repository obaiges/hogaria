import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  REALTIME_CHANNEL,
  REALTIME_EVENT_SCHEMAS,
  type PublishableRealtimeEvent,
  type RealtimeEnvelope,
  type RealtimeEventDataMap,
} from '@hogaria/shared';

import { getRequestContext } from '../common/context/request-context.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from './realtime.gateway.js';
import { groupRoom, userRoom } from './rooms.js';

export interface PublishOptions {
  /** `null` = evento de sistema (scheduler), aunque haya un usuario en la petición. */
  actorId?: string | null;
}

/**
 * **Único** punto que emite eventos en tiempo real (spec 03, RN-03-09 a RN-03-12).
 * Todos van por el canal `"evt"` con un `RealtimeEnvelope`.
 *
 * - `actorId` y `clientMutationId` salen del `RequestContext` de la petición; fuera de
 *   una petición (cron), ambos son `null`.
 * - Fuera de producción valida `data` con `REALTIME_EVENT_SCHEMAS` y **lanza** si no cumple.
 * - Si la emisión falla, se registra con `warn` y no se propaga: la petición REST no falla.
 */
@Injectable()
export class RealtimePublisher {
  private readonly logger = new Logger(RealtimePublisher.name);
  private readonly validate: boolean;

  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.validate = config.get<string>('NODE_ENV') !== 'production';
  }

  /**
   * Publica en la sala `group:<groupId>`.
   *
   * Llamar **solo después del commit** de la transacción, nunca dentro de
   * `prisma.$transaction` (patrón de mutación de docs/01-arquitectura.md): si la
   * transacción se deshace, los clientes ya habrían aplicado un cambio que no existe.
   */
  publish<E extends PublishableRealtimeEvent>(groupId: string, event: E, data: RealtimeEventDataMap[E], opts: PublishOptions = {}): void {
    this.send(groupRoom(groupId), this.envelope(event, groupId, data, opts));
  }

  /** Publica en la sala `user:<userId>` con `groupId: null` (p. ej. `session.revoked`). Después del commit. */
  publishToUser<E extends PublishableRealtimeEvent>(userId: string, event: E, data: RealtimeEventDataMap[E]): void {
    this.send(userRoom(userId), this.envelope(event, null, data, {}));
  }

  /**
   * Publica un sobre por cada grupo del usuario, cada uno con su `groupId`, en su sala
   * (`schedule.updated`, `diet.updated`). Hace una consulta de membresías. Después del commit.
   */
  async publishToUserGroups<E extends PublishableRealtimeEvent>(userId: string, event: E, data: RealtimeEventDataMap[E]): Promise<void> {
    this.check(event, data);
    let groupIds: string[];
    try {
      const memberships = await this.prisma.groupMember.findMany({ where: { userId }, select: { groupId: true } });
      groupIds = memberships.map((m) => m.groupId);
    } catch (error) {
      this.logger.warn({ err: error, event, userId }, 'No se pudieron leer los grupos del usuario para publicar');
      return;
    }
    for (const groupId of groupIds) this.send(groupRoom(groupId), this.envelope(event, groupId, data, {}));
  }

  /** Construye el sobre (y valida `data` fuera de producción). */
  protected envelope<E extends PublishableRealtimeEvent>(
    event: E,
    groupId: string | null,
    data: RealtimeEventDataMap[E],
    opts: PublishOptions,
  ): RealtimeEnvelope<RealtimeEventDataMap[E], E> {
    this.check(event, data);
    const ctx = getRequestContext();
    return {
      event,
      groupId,
      actorId: opts.actorId !== undefined ? opts.actorId : (ctx?.userId ?? null),
      clientMutationId: ctx?.clientMutationId ?? null,
      at: new Date().toISOString(),
      data,
    };
  }

  /** Emite el sobre a la sala. Los tests lo sustituyen (`FakeRealtimePublisher`). */
  protected emit(room: string, envelope: RealtimeEnvelope): void {
    this.gateway.server.to(room).emit(REALTIME_CHANNEL, envelope);
  }

  private send(room: string, envelope: RealtimeEnvelope): void {
    try {
      this.emit(room, envelope);
    } catch (error) {
      this.logger.warn({ err: error, event: envelope.event, room }, 'No se pudo emitir el evento en tiempo real');
    }
  }

  private check<E extends PublishableRealtimeEvent>(event: E, data: RealtimeEventDataMap[E]): void {
    if (!this.validate) return;
    const result = REALTIME_EVENT_SCHEMAS[event].safeParse(data);
    if (!result.success) {
      throw new Error(`RealtimePublisher: data inválido para "${event}": ${result.error.message}`);
    }
  }
}
