import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

import { useToastStore } from "@/components/ui/Toast";

/** Cada cuánto se comprueba si hay una versión nueva con la app abierta. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export const UPDATE_MESSAGE = "Hay una versión nueva de Hogaria";

/**
 * Registra el service worker (`registerType: 'prompt'`) y, cuando hay una versión nueva
 * esperando, muestra un toast persistente con "Actualizar" (`updateSW(true)` activa el
 * nuevo service worker y recarga la página).
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        void registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
    onRegisterError(error: unknown) {
      console.warn("No se pudo registrar el service worker", error);
    },
  });
  const toastId = useRef<string | null>(null);

  useEffect(() => {
    if (!needRefresh || toastId.current) return;
    toastId.current = useToastStore.getState().add({
      message: UPDATE_MESSAGE,
      actionLabel: "Actualizar",
      onAction: () => {
        void updateServiceWorker(true);
      },
      persistent: true,
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
