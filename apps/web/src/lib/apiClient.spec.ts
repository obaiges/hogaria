import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, ApiError, NetworkError } from './apiClient';
import { clearMutations, hasMutation } from './realtime/mutation-registry';

describe('apiClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    clearMutations();
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(window, 'location', {
      value: { pathname: '/g/1', search: '?x=1', assign: vi.fn() },
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('añade X-Client-Mutation-Id en mutaciones y lo registra antes de enviar', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await api.post('/x', { body: { a: 1 } });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const id = (init.headers as Record<string, string>)['X-Client-Mutation-Id'];
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(hasMutation(id)).toBe(true);
  });

  it('no añade X-Client-Mutation-Id en GET', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await api.get('/x');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Client-Mutation-Id']).toBeUndefined();
  });

  it('mapea problem+json a ApiError con mensaje en español', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ type: 't', title: 'x', status: 404, code: 'NOT_FOUND' }), {
        status: 404,
        headers: { 'content-type': 'application/problem+json' },
      }),
    );
    const err = await api.get('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect((err as ApiError).message).toBe('No encontrado');
  });

  it('401 limpia estado y redirige a /entrar?volver=...', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 401 }));
    await expect(api.get('/x')).rejects.toBeInstanceOf(ApiError);
    expect(window.location.assign).toHaveBeenCalledWith('/entrar?volver=%2Fg%2F1%3Fx%3D1');
  });

  it('error de red lanza NetworkError', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    await expect(api.post('/x')).rejects.toBeInstanceOf(NetworkError);
    await expect(api.post('/x')).rejects.toMatchObject({ message: 'No hay conexión con el servidor' });
  });
});
