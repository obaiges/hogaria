import { Injectable } from '@nestjs/common';

import { RealtimePublisher } from '../../src/realtime/realtime.publisher.js';

import type { PublishableRealtimeEvent, RealtimeEnvelope, RealtimeEventDataMap } from '@hogaria/shared';
import type { TestingModuleBuilder } from '@nestjs/testing';

export interface PublishedEvent {
  /** `group:<id>` o `user:<id>`. */
  room: string;
  envelope: RealtimeEnvelope;
}

/**
 * `RealtimePublisher` que guarda los sobres en vez de emitirlos. Construye el sobre y
 * valida `data` exactamente igual que el real (hereda de él), así que los tests de
 * integración de cada módulo comprueban el contrato sin abrir sockets.
 *
 * ```ts
 * const t = await createTestApp({ configure: useFakeRealtimePublisher });
 * const realtime = t.app.get(RealtimePublisher) as FakeRealtimePublisher;
 * expect(realtime.ofEvent('group.updated')).toHaveLength(1);
 * ```
 */
@Injectable()
export class FakeRealtimePublisher extends RealtimePublisher {
  readonly published: PublishedEvent[] = [];

  protected override emit(room: string, envelope: RealtimeEnvelope): void {
    this.published.push({ room, envelope });
  }

  /** Sobres de un evento, con `data` tipado. */
  ofEvent<E extends PublishableRealtimeEvent>(event: E): RealtimeEnvelope<RealtimeEventDataMap[E], E>[] {
    return this.published
      .filter((p) => p.envelope.event === event)
      .map((p) => p.envelope as RealtimeEnvelope<RealtimeEventDataMap[E], E>);
  }

  clear(): void {
    this.published.length = 0;
  }
}

/** Para `createTestApp({ configure: useFakeRealtimePublisher })`. */
export const useFakeRealtimePublisher = (builder: TestingModuleBuilder): TestingModuleBuilder =>
  builder.overrideProvider(RealtimePublisher).useClass(FakeRealtimePublisher);
