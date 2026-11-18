import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RealtimeProvider } from './RealtimeProvider';

const socketMock = vi.hoisted(() => {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const socket = {
    on: vi.fn((event: string, l: (...args: unknown[]) => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), l]);
      return socket;
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    emitFromServer: (event: string, ...args: unknown[]) => listeners.get(event)?.forEach((l) => l(...args)),
    reset: () => listeners.clear(),
  };
  return { socket, createSocket: vi.fn(() => socket), destroySocket: vi.fn() };
});

vi.mock('@/lib/socket', () => ({ createSocket: socketMock.createSocket, destroySocket: socketMock.destroySocket }));

function renderAt(path: string) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(['me'], { id: 'me' });
  const router = createMemoryRouter(
    [
      { path: '/entrar', element: <p>Pantalla de entrar</p> },
      { path: '/g/:groupId', element: <RealtimeProvider><p>Dentro</p></RealtimeProvider> },
    ],
    { initialEntries: [path] },
  );
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}

describe('RealtimeProvider (HOG-152)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketMock.socket.reset();
  });

  it('crea y conecta un único socket; al desmontarse (cerrar sesión) lo destruye', () => {
    const { unmount } = renderAt('/g/g1');
    expect(screen.getByText('Dentro')).toBeInTheDocument();
    expect(socketMock.createSocket).toHaveBeenCalledTimes(1);
    expect(socketMock.socket.connect).toHaveBeenCalledTimes(1);

    unmount();
    expect(socketMock.destroySocket).toHaveBeenCalledWith(socketMock.socket);
  });

  it('ACCOUNT_BLOCKED en el handshake → /entrar con el aviso de bloqueo', async () => {
    const { router } = renderAt('/g/g1');
    socketMock.socket.emitFromServer('connect_error', Object.assign(new Error('ACCOUNT_BLOCKED'), { data: { code: 'ACCOUNT_BLOCKED' } }));
    expect(await screen.findByText('Pantalla de entrar')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?error=ACCOUNT_BLOCKED');
  });

  it('UNAUTHENTICATED en el handshake → /entrar', async () => {
    renderAt('/g/g1');
    socketMock.socket.emitFromServer('connect_error', Object.assign(new Error('UNAUTHENTICATED'), { data: { code: 'UNAUTHENTICATED' } }));
    expect(await screen.findByText('Pantalla de entrar')).toBeInTheDocument();
  });
});
