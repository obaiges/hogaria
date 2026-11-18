/** Sala de todos los sockets de un usuario (eventos personales como `session.revoked`). */
export const userRoom = (userId: string) => `user:${userId}`;

/** Sala de los sockets de todos los miembros de un grupo. */
export const groupRoom = (groupId: string) => `group:${groupId}`;

/** Datos que el handshake deja en cada socket (RN-03-03). */
export interface RealtimeSocketData {
  userId: string;
  sessionId: string;
}
