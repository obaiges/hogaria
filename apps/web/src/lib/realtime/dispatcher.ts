import { isRealtimeEventName, type LaneColor, type RealtimeEnvelope, type RealtimeEventName, type TypedRealtimeEnvelope } from '@hogaria/shared';

import { getHandler, type RealtimeHandlerContext } from './handlers';
import { hasMutation } from './mutation-registry';
import { markRipple as markRippleInStore } from './ripple-store';

import type { QueryClient } from '@tanstack/react-query';

/** Eventos que se aplican aunque vengan de una mutación de esta pestaña (RN-03-17). */
export const NON_DEDUPED_EVENTS: readonly RealtimeEventName[] = ['activity.created', 'ai.quota.updated'];

/** Forma mínima de un miembro en `['group', groupId, 'members']` (GroupMemberDto, HOG-108). */
interface MemberLike {
  userId: string;
  laneColor: LaneColor;
}

export interface DispatcherDeps {
  queryClient: QueryClient;
  getMeId: () => string | null;
  /** Cierre local de la sesión (ver `RealtimeHandlerContext.endSession`). */
  endSession?: () => void;
  /** Grupo de la ruta actual (ver `RealtimeHandlerContext.activeGroupId`). */
  getActiveGroupId?: () => string | null;
  navigate?: (to: string) => void;
}

function isEnvelope(value: unknown): value is RealtimeEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<RealtimeEnvelope>;
  return isRealtimeEventName(v.event) && typeof v.at === 'string' && 'data' in v;
}

const isDeletion = (event: RealtimeEventName) => event.endsWith('.deleted') || event.endsWith('_deleted');

/** Color de calle del autor, desde la caché de miembros del grupo (o `null`). */
function actorLaneColor(queryClient: QueryClient, groupId: string | null, actorId: string): LaneColor | null {
  if (!groupId) return null;
  const members = queryClient.getQueryData<MemberLike[]>(['group', groupId, 'members']);
  return members?.find((m) => m.userId === actorId)?.laneColor ?? null;
}

/**
 * Crea el único listener del canal `"evt"` (RN-03-17): descarta los eventos de las
 * mutaciones propias (salvo `NON_DEDUPED_EVENTS`), busca el manejador del evento y le
 * pasa `{ queryClient, meId, markRipple }`. Eventos sin manejador o mal formados se ignoran.
 */
export function createDispatcher({
  queryClient,
  getMeId,
  endSession = () => {},
  getActiveGroupId = () => null,
  navigate = () => {},
}: DispatcherDeps): (payload: unknown) => void {
  return (payload) => {
    if (!isEnvelope(payload)) return;
    const envelope = payload;
    if (hasMutation(envelope.clientMutationId) && !NON_DEDUPED_EVENTS.includes(envelope.event)) return;

    const handler = getHandler(envelope.event);
    if (!handler) {
      if (import.meta.env.DEV) console.debug('[realtime] evento sin manejador', envelope.event);
      return;
    }

    const meId = getMeId();
    const ctx: RealtimeHandlerContext = {
      queryClient,
      meId,
      endSession,
      activeGroupId: getActiveGroupId(),
      navigate,
      // Onda solo para cambios de otro miembro (no del sistema ni de mí en otro dispositivo) y nunca en borrados (RN-03-19).
      markRipple: (entityKey) => {
        const { actorId } = envelope;
        if (actorId === null || actorId === meId || isDeletion(envelope.event)) return;
        markRippleInStore(entityKey, actorLaneColor(queryClient, envelope.groupId, actorId));
      },
    };

    try {
      handler(envelope as TypedRealtimeEnvelope<RealtimeEventName>, ctx);
    } catch (error) {
      console.warn('[realtime] error en el manejador de', envelope.event, error);
    }
  };
}
