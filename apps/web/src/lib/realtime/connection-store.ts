import { create } from 'zustand';

/**
 * Estado del socket (stub de HOG-152). HOG-155 lo amplía con `'online' | 'reconnecting' |
 * 'offline'`, `navigator.onLine` y el margen de 5 s (spec 03, RN-03-22). Aquí solo se
 * reflejan los eventos `connect`/`disconnect`.
 */
interface ConnectionState {
  /** `true` mientras el socket está conectado. */
  socketConnected: boolean;
  /** `Date.now()` de la última desconexión, o `null`. */
  disconnectedAt: number | null;
}

export const useConnectionStore = create<ConnectionState>(() => ({ socketConnected: false, disconnectedAt: null }));

export function socketConnected(): void {
  useConnectionStore.setState({ socketConnected: true, disconnectedAt: null });
}

export function socketDisconnected(): void {
  useConnectionStore.setState({ socketConnected: false, disconnectedAt: Date.now() });
}
