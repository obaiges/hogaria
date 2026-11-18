import { REALTIME_CHANNEL } from '@hogaria/shared';

import { socketConnected, socketDisconnected } from './connection-store';
import { createDispatcher } from './dispatcher';

import type { QueryClient } from '@tanstack/react-query';

/** Errores del handshake que cierran la sesión local (spec 03, RN-03-21). */
export type RealtimeAuthErrorCode = 'UNAUTHENTICATED' | 'ACCOUNT_BLOCKED';

/** Lo mínimo del socket que se usa (facilita el mock en los tests). */
export interface RealtimeSocketLike {
  on(event: string, listener: (...args: never[]) => void): unknown;
  disconnect(): unknown;
}

export interface BindRealtimeDeps {
  queryClient: QueryClient;
  getMeId: () => string | null;
  /** Grupo de la ruta actual (`/g/:groupId/…`) o `null`. */
  getActiveGroupId: () => string | null;
  /** Ya se han parado las reconexiones y limpiado la caché: solo queda navegar. */
  onAuthError: (code: RealtimeAuthErrorCode) => void;
}

function authErrorCode(err: unknown): RealtimeAuthErrorCode | null {
  const e = err as { message?: unknown; data?: { code?: unknown } } | null;
  const code = e?.data?.code ?? e?.message;
  return code === 'UNAUTHENTICATED' || code === 'ACCOUNT_BLOCKED' ? code : null;
}

/**
 * Al reconectar (cualquier `connect` que no sea el primero) se pone al día: no se
 * reproducen los eventos perdidos (RN-03-20).
 */
export function refreshAfterReconnect(queryClient: QueryClient, activeGroupId: string | null): void {
  if (activeGroupId) void queryClient.invalidateQueries({ queryKey: ['group', activeGroupId] });
  void queryClient.invalidateQueries({ queryKey: ['me', 'groups'] });
  void queryClient.invalidateQueries({
    queryKey: ['group'],
    predicate: (query) => query.queryKey[1] !== activeGroupId,
    refetchType: 'none',
  });
}

/**
 * Conecta un socket con la app: listener de `"evt"`, estado de conexión, reconexión y
 * errores de autenticación del handshake. No conecta el socket.
 */
export function bindRealtime(socket: RealtimeSocketLike, deps: BindRealtimeDeps): void {
  const dispatch = createDispatcher({ queryClient: deps.queryClient, getMeId: deps.getMeId });
  let connectedBefore = false;

  socket.on(REALTIME_CHANNEL, dispatch as (...args: never[]) => void);

  socket.on('connect', () => {
    socketConnected();
    if (connectedBefore) refreshAfterReconnect(deps.queryClient, deps.getActiveGroupId());
    connectedBefore = true;
  });

  socket.on('disconnect', () => socketDisconnected());

  socket.on('connect_error', ((err: unknown) => {
    const code = authErrorCode(err);
    if (!code) return; // error de red: Socket.IO sigue reintentando
    socket.disconnect(); // detiene la reconexión
    deps.queryClient.clear();
    deps.onAuthError(code);
  }) as (...args: never[]) => void);
}
