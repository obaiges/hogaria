import { io, type Socket } from 'socket.io-client';

import { REALTIME_PATH } from '@hogaria/shared';

/**
 * Único socket de la pestaña (spec 03, RN-03-15). En local la URL es relativa y pasa por
 * el proxy de Vite (`/realtime`, `ws: true`); en producción, `VITE_API_URL`.
 * Se crea sin conectar: el `RealtimeProvider` registra los listeners y después conecta.
 */
export function createSocket(): Socket {
  const options = {
    path: REALTIME_PATH,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 5_000,
    autoConnect: false,
  };
  const url = import.meta.env.VITE_API_URL;
  return url ? io(url, options) : io(options);
}

/** Desconecta y suelta todos los listeners (al cerrar sesión o desmontar el layout privado). */
export function destroySocket(socket: Socket): void {
  socket.removeAllListeners();
  socket.io.removeAllListeners();
  socket.disconnect();
}
