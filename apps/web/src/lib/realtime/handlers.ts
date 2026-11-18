import { activityHandlers } from '@/features/activity/realtime';
import { authHandlers } from '@/features/auth/realtime';
import { dashboardHandlers } from '@/features/dashboard/realtime';
import { groupHandlers } from '@/features/groups/realtime';

import type { RealtimeEventName, TypedRealtimeEnvelope } from '@hogaria/shared';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Manejadores de eventos en tiempo real (spec 03, RN-03-17 y RN-03-18).
 *
 * ## Cómo añade una feature sus manejadores
 *
 * 1. Crea `features/<x>/realtime.ts` y exporta un objeto con un manejador por evento:
 *
 *    ```ts
 *    export const shoppingHandlers: RealtimeHandlers = {
 *      'shopping.item.updated': (envelope, { queryClient, markRipple }) => {
 *        const item = envelope.data;
 *        queryClient.setQueryData<ShoppingItemDto[]>(
 *          ['group', envelope.groupId, 'shopping', 'lists', item.listId, 'items'],
 *          (old) => old?.map((i) => (i.id === item.id ? item : i)),   // old undefined → undefined
 *        );
 *        markRipple(`shopping_item:${item.id}`);
 *      },
 *    };
 *    ```
 *
 * 2. Añádelo a `FEATURE_HANDLERS` (abajo). `registerFeatureHandlers()` los registra al
 *    montar el `RealtimeProvider`.
 *
 * ## Reglas
 *
 * - **El *updater* nunca crea queries:** si la query no está en caché (`old === undefined`),
 *   devuelve `undefined` y no hace nada. Así un evento de un grupo que no se ha abierto no
 *   rellena la caché con datos a medias (RN-03-18). Funciona también con grupos no activos.
 * - Si el cambio afecta a vistas calculadas (totales, resúmenes), usa `invalidateQueries`.
 * - `markRipple(entityKey)` ya ignora los cambios propios, los de sistema y los `*.deleted`:
 *   llámalo sin comprobar nada en las creaciones y modificaciones.
 * - Los eventos de mutaciones de esta pestaña no llegan aquí (los filtra el dispatcher por
 *   `clientMutationId`), salvo `NON_DEDUPED_EVENTS`.
 */
export interface RealtimeHandlerContext {
  queryClient: QueryClient;
  /** Usuario actual (`null` si aún no se conoce). */
  meId: string | null;
  /** Marca la onda en `"<entityType>:<id>"` con el color de calle del autor (RN-03-19). */
  markRipple: (entityKey: string) => void;
  /**
   * La sesión de este dispositivo ya no existe (p. ej. `session.revoked`): desconecta el
   * socket, limpia la caché y vuelve a `/entrar` con el aviso (spec 01 §5).
   */
  endSession: () => void;
  /** Grupo de la ruta actual (`/g/:groupId/…`) o `null`. */
  activeGroupId: string | null;
  /** Navega dentro de la app (p. ej. a `/grupos` si te han sacado del hogar activo, RN-02-32). */
  navigate: (to: string) => void;
}

export type RealtimeHandler<E extends RealtimeEventName> = (envelope: TypedRealtimeEnvelope<E>, ctx: RealtimeHandlerContext) => void;

export type RealtimeHandlers = { [E in RealtimeEventName]?: RealtimeHandler<E> };

/** Manejadores de cada feature. Cada épica añade aquí los suyos (`features/<x>/realtime.ts`). */
const FEATURE_HANDLERS: RealtimeHandlers[] = [authHandlers, groupHandlers, activityHandlers, dashboardHandlers];

const registry = new Map<RealtimeEventName, Array<RealtimeHandler<RealtimeEventName>>>();

/**
 * Registra manejadores. Un evento puede tener varios (p. ej. `activity.created` lo usan
 * Actividad e Inicio): se ejecutan en orden de registro. Registrar dos veces la misma función
 * no la duplica (`registerFeatureHandlers()` se llama en cada montaje del provider).
 */
export function registerHandlers(handlers: RealtimeHandlers): void {
  for (const [event, handler] of Object.entries(handlers) as Array<[RealtimeEventName, RealtimeHandler<RealtimeEventName> | undefined]>) {
    if (!handler) continue;
    const list = registry.get(event) ?? [];
    if (!list.includes(handler)) registry.set(event, [...list, handler]);
  }
}

export function registerFeatureHandlers(): void {
  for (const handlers of FEATURE_HANDLERS) registerHandlers(handlers);
}

/**
 * Manejador del evento: los registrados, uno detrás de otro. Si uno falla, los demás se
 * ejecutan igualmente y el error se relanza al final (el dispatcher lo registra).
 */
export function getHandler<E extends RealtimeEventName>(event: E): RealtimeHandler<E> | undefined {
  const list = registry.get(event) as Array<RealtimeHandler<E>> | undefined;
  if (!list?.length) return undefined;
  const [only] = list;
  if (list.length === 1 && only) return only;
  return (envelope, ctx) => {
    let failure: unknown = null;
    for (const handler of list) {
      try {
        handler(envelope, ctx);
      } catch (error) {
        failure ??= error;
      }
    }
    if (failure) throw failure;
  };
}

/** Solo para tests. */
export function clearHandlers(): void {
  registry.clear();
}
