import { create } from 'zustand';

/** Estado de conexión (spec 03, RN-03-22). */
export type ConnectionStatus = 'online' | 'reconnecting' | 'offline';

/** Margen antes de dar por perdido el socket: cortes más cortos no muestran el banner. */
export const OFFLINE_GRACE_MS = 5000;

/**
 * - `none`: no hay socket (pantallas públicas): solo cuenta `navigator.onLine`.
 * - `connecting`: primera conexión; cuenta como `online` hasta que pase el margen.
 * - `connected` / `disconnected`: tras un corte, `reconnecting` hasta que pase el margen.
 */
export type SocketPhase = 'none' | 'connecting' | 'connected' | 'disconnected';

interface ConnectionState {
  browserOnline: boolean;
  socket: SocketPhase;
  /** Ha pasado `OFFLINE_GRACE_MS` en `connecting` o `disconnected` sin conectar. */
  graceExpired: boolean;
  status: ConnectionStatus;
}

export function computeStatus({ browserOnline, socket, graceExpired }: Omit<ConnectionState, 'status'>): ConnectionStatus {
  if (!browserOnline) return 'offline';
  if (socket === 'connecting') return graceExpired ? 'offline' : 'online';
  if (socket === 'disconnected') return graceExpired ? 'offline' : 'reconnecting';
  return 'online';
}

const initialBrowserOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

export const useConnectionStore = create<ConnectionState>(() => ({
  browserOnline: initialBrowserOnline(),
  socket: 'none',
  graceExpired: false,
  status: initialBrowserOnline() ? 'online' : 'offline',
}));

let graceTimer: ReturnType<typeof setTimeout> | null = null;

function clearGrace(): void {
  if (graceTimer !== null) clearTimeout(graceTimer);
  graceTimer = null;
}

function update(patch: Partial<Omit<ConnectionState, 'status'>>): void {
  const next = { ...useConnectionStore.getState(), ...patch };
  useConnectionStore.setState({ ...patch, status: computeStatus(next) });
}

function startGrace(): void {
  clearGrace();
  graceTimer = setTimeout(() => {
    graceTimer = null;
    update({ graceExpired: true });
  }, OFFLINE_GRACE_MS);
}

/** El `RealtimeProvider` empieza a conectar el socket. */
export function socketConnecting(): void {
  update({ socket: 'connecting', graceExpired: false });
  startGrace();
}

export function socketConnected(): void {
  clearGrace();
  update({ socket: 'connected', graceExpired: false });
}

export function socketDisconnected(): void {
  // Un `disconnect` sin haber conectado nunca sigue contando el margen de arranque.
  if (useConnectionStore.getState().socket === 'connecting') return;
  update({ socket: 'disconnected', graceExpired: false });
  startGrace();
}

/** Ya no hay socket (cerrar sesión, salir de las rutas privadas). */
export function socketStopped(): void {
  clearGrace();
  update({ socket: 'none', graceExpired: false });
}

export function setBrowserOnline(online: boolean): void {
  update({ browserOnline: online });
}

export function getConnectionStatus(): ConnectionStatus {
  return useConnectionStore.getState().status;
}

/** Escucha `online`/`offline` del navegador. Devuelve la función para dejar de escuchar. */
export function listenBrowserConnection(target: Window = window): () => void {
  const onOnline = () => setBrowserOnline(true);
  const onOffline = () => setBrowserOnline(false);
  target.addEventListener('online', onOnline);
  target.addEventListener('offline', onOffline);
  setBrowserOnline(target.navigator.onLine);
  return () => {
    target.removeEventListener('online', onOnline);
    target.removeEventListener('offline', onOffline);
  };
}

/** Solo para tests. */
export function resetConnectionStore(browserOnline = true): void {
  clearGrace();
  useConnectionStore.setState({ browserOnline, socket: 'none', graceExpired: false, status: browserOnline ? 'online' : 'offline' });
}

export function useConnectionStatus(): ConnectionStatus {
  return useConnectionStore((s) => s.status);
}

/** Se puede editar salvo en `offline` (RN-03-23). */
export function useCanEdit(): boolean {
  return useConnectionStore((s) => s.status !== 'offline');
}

/** Texto del aviso y del toast sin conexión (RN-03-23). */
export const OFFLINE_MESSAGE = 'Sin conexión. Los cambios no se guardarán';
/** `title` de los controles deshabilitados por falta de conexión. */
export const OFFLINE_TITLE = 'Sin conexión';
