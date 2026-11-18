import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';
import { useMatch, useNavigate } from 'react-router';

import { SESSION_ENDED_PARAM, useMe } from '@/features/auth/api';
import { bindRealtime, type RealtimeAuthErrorCode } from '@/lib/realtime/connection';
import { registerFeatureHandlers } from '@/lib/realtime/handlers';
import { clearMutations } from '@/lib/realtime/mutation-registry';
import { clearRipples } from '@/lib/realtime/ripple-store';
import { createSocket, destroySocket } from '@/lib/socket';

/**
 * Un único socket por pestaña dentro del layout autenticado (spec 03, RN-03-15 a RN-03-21).
 * Al desmontarse (cerrar sesión, salir de las rutas privadas) desconecta y destruye el socket.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const groupMatch = useMatch('/g/:groupId/*');

  // Refs: el socket vive mientras dure el layout, sin reconectar al cambiar de ruta.
  const meId = me?.id ?? null;
  const activeGroupId = groupMatch?.params.groupId ?? null;
  const meIdRef = useRef<string | null>(meId);
  const activeGroupRef = useRef<string | null>(activeGroupId);
  const navigateRef = useRef(navigate);
  useEffect(() => {
    meIdRef.current = meId;
    activeGroupRef.current = activeGroupId;
    navigateRef.current = navigate;
  }, [meId, activeGroupId, navigate]);

  useEffect(() => {
    registerFeatureHandlers();
    const socket = createSocket();
    bindRealtime(socket, {
      queryClient,
      getMeId: () => meIdRef.current,
      getActiveGroupId: () => activeGroupRef.current,
      onAuthError: (code: RealtimeAuthErrorCode) => {
        clearMutations();
        clearRipples();
        if (code === 'ACCOUNT_BLOCKED') {
          void navigateRef.current('/entrar?error=ACCOUNT_BLOCKED', { replace: true });
        } else {
          const volver = encodeURIComponent(window.location.pathname + window.location.search);
          void navigateRef.current(`/entrar?volver=${volver}`, { replace: true });
        }
      },
      onSessionEnded: () => {
        clearMutations();
        clearRipples();
        void navigateRef.current(`/entrar?${SESSION_ENDED_PARAM}`, { replace: true });
      },
    });
    socket.connect();
    return () => destroySocket(socket);
  }, [queryClient]);

  return <>{children}</>;
}
