import { Injectable } from '@nestjs/common';

import { RealtimeGateway } from './realtime.gateway.js';
import { groupRoom, userRoom } from './rooms.js';

/**
 * Ajusta las salas de **todos** los sockets de un usuario sin que el cliente intervenga
 * (RN-03-06). Lo usan los servicios de grupos al unirse, salir, expulsar o borrar.
 * Llamar después del commit de la transacción.
 */
@Injectable()
export class RealtimeRooms {
  constructor(private readonly gateway: RealtimeGateway) {}

  joinGroup(userId: string, groupId: string): void {
    this.gateway.server.in(userRoom(userId)).socketsJoin(groupRoom(groupId));
  }

  leaveGroup(userId: string, groupId: string): void {
    this.gateway.server.in(userRoom(userId)).socketsLeave(groupRoom(groupId));
  }
}
