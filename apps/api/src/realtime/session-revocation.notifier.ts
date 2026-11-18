import { Injectable, type OnModuleInit } from '@nestjs/common';

import { SessionRevocationRef, type SessionRevocationListener } from '../auth/session-hooks.js';
import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimePublisher } from './realtime.publisher.js';

/**
 * RN-01-22 (pasos 2 y 3): tras borrar las sesiones, publica `session.revoked` en
 * `user:<id>` y desconecta los sockets de esas sesiones. Se registra en
 * `SessionRevocationRef` al arrancar (Better Auth se crea antes que el gateway).
 */
@Injectable()
export class SessionRevocationNotifier implements SessionRevocationListener, OnModuleInit {
  constructor(
    private readonly ref: SessionRevocationRef,
    private readonly publisher: RealtimePublisher,
    private readonly gateway: RealtimeGateway,
  ) {}

  onModuleInit(): void {
    this.ref.set(this);
  }

  async onSessionsRevoked(userId: string, sessionIds: string[]): Promise<void> {
    this.publisher.publishToUser(userId, 'session.revoked', {});
    await this.gateway.disconnectSessions(userId, { sessionIds });
  }
}
