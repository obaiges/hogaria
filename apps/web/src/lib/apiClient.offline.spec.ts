import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryClient } from '@/app/queryClient';
import { useToastStore } from '@/components/ui/Toast';

import { api, OfflineError } from './apiClient';
import { resetConnectionStore, setBrowserOnline } from './realtime/connection-store';
import { clearMutations } from './realtime/mutation-registry';

const json = () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });

describe('apiClient sin conexión (RN-03-23)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    clearMutations();
    useToastStore.setState({ toasts: [] });
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve(json()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetConnectionStore();
  });

  it.each(['post', 'patch', 'put', 'delete'] as const)('%s en offline → OfflineError sin enviar y toast', async (method) => {
    setBrowserOnline(false);
    await expect(api[method]('/x', { body: {} })).rejects.toBeInstanceOf(OfflineError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['Sin conexión. Los cambios no se guardarán']);
  });

  it('las lecturas se siguen intentando en offline', async () => {
    setBrowserOnline(false);
    await expect(api.get('/x')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('online: la mutación se envía', async () => {
    await api.post('/x', { body: {} });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("las mutaciones de TanStack Query no se encolan (networkMode 'always')", () => {
    expect(queryClient.getDefaultOptions().mutations?.networkMode).toBe('always');
  });
});
