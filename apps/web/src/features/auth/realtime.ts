import { authClient } from "@/lib/authClient";

import { sessionsQueryKey } from "./api";

import type { RealtimeHandlers } from "@/lib/realtime/handlers";

/**
 * `session.revoked` (spec 01 §5): se ha revocado alguna sesión del usuario. Si era la de
 * este dispositivo (`getSession()` → `null`), se cierra la sesión local; si no, solo se
 * refresca la lista de dispositivos. Un error de red no cierra nada.
 */
export const authHandlers: RealtimeHandlers = {
  "session.revoked": (_envelope, { queryClient, endSession }) => {
    void (async () => {
      try {
        const { data, error } = await authClient.getSession();
        if (error) return;
        if (!data) endSession();
        else void queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
      } catch {
        // Sin red: no se sabe si la sesión sigue viva; el siguiente 401 lo resolverá.
      }
    })();
  },
};
