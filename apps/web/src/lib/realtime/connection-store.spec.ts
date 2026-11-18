import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  computeStatus,
  getConnectionStatus,
  listenBrowserConnection,
  OFFLINE_GRACE_MS,
  resetConnectionStore,
  setBrowserOnline,
  socketConnected,
  socketConnecting,
  socketDisconnected,
  socketStopped,
  useConnectionStore,
} from './connection-store';

describe('connection-store (RN-03-22)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetConnectionStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetConnectionStore();
  });

  it('sin socket solo cuenta navigator.onLine', () => {
    expect(getConnectionStatus()).toBe('online');
    setBrowserOnline(false);
    expect(getConnectionStatus()).toBe('offline');
    setBrowserOnline(true);
    expect(getConnectionStatus()).toBe('online');
  });

  it('al arrancar cuenta como online mientras conecta y pasa a offline a los 5 s sin conectar', () => {
    socketConnecting();
    expect(getConnectionStatus()).toBe('online');
    vi.advanceTimersByTime(OFFLINE_GRACE_MS - 1);
    expect(getConnectionStatus()).toBe('online');
    vi.advanceTimersByTime(1);
    expect(getConnectionStatus()).toBe('offline');
    socketConnected();
    expect(getConnectionStatus()).toBe('online');
  });

  it('un disconnect antes del primer connect no cambia el margen de arranque', () => {
    socketConnecting();
    vi.advanceTimersByTime(3000);
    socketDisconnected();
    expect(useConnectionStore.getState().socket).toBe('connecting');
    vi.advanceTimersByTime(2000);
    expect(getConnectionStatus()).toBe('offline');
  });

  it('tras un corte: reconnecting durante 5 s y luego offline', () => {
    socketConnecting();
    socketConnected();
    socketDisconnected();
    expect(getConnectionStatus()).toBe('reconnecting');
    vi.advanceTimersByTime(OFFLINE_GRACE_MS - 1);
    expect(getConnectionStatus()).toBe('reconnecting');
    vi.advanceTimersByTime(1);
    expect(getConnectionStatus()).toBe('offline');
  });

  it('si reconecta antes de 5 s nunca pasa a offline', () => {
    socketConnecting();
    socketConnected();
    socketDisconnected();
    vi.advanceTimersByTime(4000);
    socketConnected();
    vi.advanceTimersByTime(10_000);
    expect(getConnectionStatus()).toBe('online');
  });

  it('navigator.onLine === false gana a un socket conectado', () => {
    socketConnecting();
    socketConnected();
    setBrowserOnline(false);
    expect(getConnectionStatus()).toBe('offline');
  });

  it('socketStopped vuelve a depender solo del navegador y cancela el temporizador', () => {
    socketConnecting();
    socketConnected();
    socketDisconnected();
    socketStopped();
    vi.advanceTimersByTime(OFFLINE_GRACE_MS * 2);
    expect(getConnectionStatus()).toBe('online');
  });

  it('escucha online/offline del navegador', () => {
    const target = new EventTarget() as unknown as Window;
    Object.defineProperty(target, 'navigator', { value: { onLine: true } });
    const stop = listenBrowserConnection(target);
    target.dispatchEvent(new Event('offline'));
    expect(getConnectionStatus()).toBe('offline');
    target.dispatchEvent(new Event('online'));
    expect(getConnectionStatus()).toBe('online');
    stop();
    target.dispatchEvent(new Event('offline'));
    expect(getConnectionStatus()).toBe('online');
  });

  it('computeStatus cubre todas las combinaciones', () => {
    expect(computeStatus({ browserOnline: true, socket: 'connected', graceExpired: false })).toBe('online');
    expect(computeStatus({ browserOnline: true, socket: 'disconnected', graceExpired: false })).toBe('reconnecting');
    expect(computeStatus({ browserOnline: true, socket: 'disconnected', graceExpired: true })).toBe('offline');
    expect(computeStatus({ browserOnline: true, socket: 'connecting', graceExpired: true })).toBe('offline');
    expect(computeStatus({ browserOnline: false, socket: 'none', graceExpired: false })).toBe('offline');
  });
});
