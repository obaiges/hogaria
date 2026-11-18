import { authHandlers } from '@/features/auth/realtime';

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
}

export type RealtimeHandler<E extends RealtimeEventName> = (envelope: TypedRealtimeEnvelope<E>, ctx: RealtimeHandlerContext) => void;

export type RealtimeHandlers = { [E in RealtimeEventName]?: RealtimeHandler<E> };

/** Manejadores de cada feature. Cada épica añade aquí los suyos (`features/<x>/realtime.ts`). */
const FEATURE_HANDLERS: RealtimeHandlers[] = [authHandlers];

const registry = new Map<RealtimeEventName, RealtimeHandler<RealtimeEventName>>();

/** Registra manejadores; un evento ya registrado se sustituye. */
export function registerHandlers(handlers: RealtimeHandlers): void {
  for (const [event, handler] of Object.entries(handlers) as Array<[RealtimeEventName, RealtimeHandler<RealtimeEventName> | undefined]>) {
    if (handler) registry.set(event, handler);
  }
}

export function registerFeatureHandlers(): void {
  for (const handlers of FEATURE_HANDLERS) registerHandlers(handlers);
}

export function getHandler<E extends RealtimeEventName>(event: E): RealtimeHandler<E> | undefined {
  return registry.get(event) as RealtimeHandler<E> | undefined;
}

/** Solo para tests. */
export function clearHandlers(): void {
  registry.clear();
}
