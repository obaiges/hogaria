import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bindRealtime, type BindRealtimeDeps, type RealtimeSocketLike } from './connection';
import { resetConnectionStore, useConnectionStore } from './connection-store';
import { clearHandlers, registerHandlers } from './handlers';

type Listener = (...args: unknown[]) => void;

/** Socket falso: guarda los listeners y permite emitir eventos del servidor. */
class MockSocket {
  listeners = new Map<string, Listener[]>();
  disconnect = vi.fn();

  on(event: string, listener: Listener) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }

  serverEmit(event: string, ...args: unknown[]) {
    for (const l of this.listeners.get(event) ?? []) l(...args);
  }
}

describe('bindRealtime (RN-03-20 y RN-03-21)', () => {
  let socket: MockSocket;
  let queryClient: QueryClient;
  let deps: BindRealtimeDeps;

  beforeEach(() => {
    socket = new MockSocket();
    queryClient = new QueryClient();
    deps = { queryClient, getMeId: () => 'me', getActiveGroupId: () => 'g-active', onAuthError: vi.fn() };
    clearHandlers();
    resetConnectionStore();
  });

  it('el primer connect no invalida; cada reconexión invalida una vez', () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    bindRealtime(socket as unknown as RealtimeSocketLike, deps);

    socket.serverEmit('connect');
    expect(invalidate).not.toHaveBeenCalled();

    socket.serverEmit('disconnect', 'transport close');
    socket.serverEmit('connect');
    expect(invalidate).toHaveBeenCalledTimes(3); // grupo activo + me/groups + resto de grupos sin refetch
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['group', 'g-active'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['me', 'groups'] });
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['group'], refetchType: 'none' }));
  });

  it('al reconectar: el grupo activo se recarga y los demás solo quedan obsoletos', async () => {
    queryClient.setQueryData(['group', 'g-active'], { id: 'g-active' });
    queryClient.setQueryData(['group', 'g-other', 'tasks'], []);
    queryClient.setQueryData(['me', 'groups'], []);
    bindRealtime(socket as unknown as RealtimeSocketLike, deps);
    socket.serverEmit('connect');
    socket.serverEmit('connect');

    const state = (key: unknown[]) => queryClient.getQueryState(key)?.isInvalidated;
    expect(state(['group', 'g-active'])).toBe(true);
    expect(state(['me', 'groups'])).toBe(true);
    expect(state(['group', 'g-other', 'tasks'])).toBe(true);
  });

  it('sin grupo activo, invalida me/groups y marca obsoletos todos los grupos', () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    bindRealtime(socket as unknown as RealtimeSocketLike, { ...deps, getActiveGroupId: () => null });
    socket.serverEmit('connect');
    socket.serverEmit('connect');
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('refleja connect/disconnect en el connection-store', () => {
    bindRealtime(socket as unknown as RealtimeSocketLike, deps);
    expect(useConnectionStore.getState()).toMatchObject({ socket: 'connecting', status: 'online' });
    socket.serverEmit('connect');
    expect(useConnectionStore.getState()).toMatchObject({ socket: 'connected', status: 'online' });
    socket.serverEmit('disconnect', 'transport close');
    expect(useConnectionStore.getState()).toMatchObject({ socket: 'disconnected', status: 'reconnecting' });
  });

  it.each(['UNAUTHENTICATED', 'ACCOUNT_BLOCKED'] as const)('connect_error %s: para la reconexión, limpia la caché y avisa', (code) => {
    queryClient.setQueryData(['me'], { id: 'me' });
    bindRealtime(socket as unknown as RealtimeSocketLike, deps);
    socket.serverEmit('connect_error', Object.assign(new Error(code), { data: { code } }));

    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['me'])).toBeUndefined();
    expect(deps.onAuthError).toHaveBeenCalledWith(code);
  });

  it('connect_error de red: no hace nada (Socket.IO sigue reintentando)', () => {
    queryClient.setQueryData(['me'], { id: 'me' });
    bindRealtime(socket as unknown as RealtimeSocketLike, deps);
    socket.serverEmit('connect_error', new Error('xhr poll error'));
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(['me'])).toEqual({ id: 'me' });
    expect(deps.onAuthError).not.toHaveBeenCalled();
  });

  it('los sobres del canal evt llegan al dispatcher', () => {
    const handler = vi.fn();
    registerHandlers({ 'task.created': handler });
    bindRealtime(socket as unknown as RealtimeSocketLike, deps);
    socket.serverEmit('evt', { event: 'task.created', groupId: 'g', actorId: 'x', clientMutationId: null, at: 'now', data: {} });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
