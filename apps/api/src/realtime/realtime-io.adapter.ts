import { IoAdapter } from '@nestjs/platform-socket.io';

import type { INestApplicationContext } from '@nestjs/common';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Adaptador de Socket.IO con el CORS de la API (`APP_URL` y, en desarrollo,
 * localhost:5173, con credenciales). El CORS va aquí y no en `@WebSocketGateway`
 * porque depende de la configuración, que no existe al cargar el decorador.
 * Adaptador en memoria: una sola instancia de API (RN-03-01).
 */
export class RealtimeIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly allowedOrigins: readonly string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const withCors = { ...options, cors: { origin: [...this.allowedOrigins], credentials: true } } as ServerOptions;
    return super.createIOServer(port, withCors) as Server;
  }
}
