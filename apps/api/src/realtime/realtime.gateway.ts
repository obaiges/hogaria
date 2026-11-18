import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebSocketGateway, WebSocketServer, type OnGatewayInit } from '@nestjs/websockets';

import { AUTH, type Auth } from '../auth/auth.js';
import { getAllowedOrigins } from '../common/security/allowed-origins.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { groupRoom, userRoom, type RealtimeSocketData } from './rooms.js';
import { createSocketAuthMiddleware } from './socket-auth.middleware.js';

import type { RealtimeEnvelope } from '@hogaria/shared';
import type { Server, Socket } from 'socket.io';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- el cliente no emite nada (RN-03-04)
type ClientToServerEvents = {};
// Un único canal `evt` con el sobre; solo lo emite el RealtimePublisher (RN-03-09).
interface ServerToClientEvents {
  evt: (envelope: RealtimeEnvelope) => void;
}

export type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, RealtimeSocketData>;
type RealtimeSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, RealtimeSocketData>;

export interface DisconnectSessionsOptions {
  /** Solo los sockets de estas sesiones. */
  sessionIds?: string[];
  /** Todos menos los de esta sesión (p. ej. "cerrar las demás"). */
  exceptSessionId?: string;
}

/**
 * Socket.IO en `/realtime` (spec 03, RN-03-01 a RN-03-08). Solo de bajada: no hay
 * `@SubscribeMessage`, así que lo que emita el cliente se ignora. El CORS lo pone
 * `RealtimeIoAdapter` con los mismos orígenes que la API REST.
 *
 * Única consulta a la BBDD del ciclo de vida del socket: las membresías al conectar (ADR-004).
 */
@WebSocketGateway({ path: '/realtime', transports: ['websocket', 'polling'] })
export class RealtimeGateway implements OnGatewayInit {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: RealtimeServer;

  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  afterInit(server: RealtimeServer): void {
    const allowedOrigins = getAllowedOrigins({ NODE_ENV: this.config.get('NODE_ENV'), APP_URL: this.config.get('APP_URL') });
    server.use(createSocketAuthMiddleware({ auth: this.auth, allowedOrigins }));
    // Las salas se unen en el handshake (antes de `connect`) para que no se pierda
    // ningún evento publicado justo después de conectar.
    server.use((socket: RealtimeSocket, next) => {
      void this.joinInitialRooms(socket).then(
        () => next(),
        (error: unknown) => {
          this.logger.error({ err: error }, 'No se pudieron unir las salas del socket');
          next(new Error('INTERNAL'));
        },
      );
    });
  }

  private async joinInitialRooms(socket: RealtimeSocket): Promise<void> {
    const { userId } = socket.data;
    const memberships = await this.prisma.groupMember.findMany({ where: { userId }, select: { groupId: true } });
    await socket.join([userRoom(userId), ...memberships.map((m) => groupRoom(m.groupId))]);
  }

  /**
   * Desconecta los sockets de `userId` (RN-03-07): los de `sessionIds`, o todos menos
   * `exceptSessionId`, o todos. Se llama **después** de publicar `session.revoked`.
   */
  async disconnectSessions(userId: string, options: DisconnectSessionsOptions = {}): Promise<number> {
    const sockets = await this.server.in(userRoom(userId)).fetchSockets();
    const targets = sockets.filter(({ data }) => {
      if (options.sessionIds) return options.sessionIds.includes(data.sessionId);
      if (options.exceptSessionId) return data.sessionId !== options.exceptSessionId;
      return true;
    });
    for (const socket of targets) socket.disconnect(true);
    return targets.length;
  }
}
