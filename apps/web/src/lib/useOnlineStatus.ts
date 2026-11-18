import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * `navigator.onLine` reactivo. Mínimo para deshabilitar acciones sin conexión hasta que
 * HOG-155 añada el estado completo de conexión (socket + margen de 5 s, spec 03 RN-03-22).
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
