import type { ActivityPages } from "./api";
import type { RealtimeHandlers } from "@/lib/realtime/handlers";

/** Clave de onda de una entrada de actividad. */
export const activityRippleKey = (id: string) => `activity:${id}`;

/**
 * `activity.created` (spec 03 §6): si la *infinite query* existe, la entrada va al principio de
 * la primera página (sin duplicar por `id`), con onda si es de otro; e invalida el Inicio.
 * No se deduplica por `clientMutationId` (`NON_DEDUPED_EVENTS`): el autor también la ve.
 */
export const activityHandlers: RealtimeHandlers = {
  "activity.created": ({ data: item }, { queryClient, markRipple }) => {
    const key = ["group", item.groupId, "activity"];
    queryClient.setQueryData<ActivityPages>(key, (old) => {
      if (!old) return old;
      if (old.pages.some((p) => p.items.some((i) => i.id === item.id))) return old;
      const [first, ...rest] = old.pages;
      if (!first) return old;
      return { ...old, pages: [{ ...first, items: [item, ...first.items] }, ...rest] };
    });
    markRipple(activityRippleKey(item.id));
    void queryClient.invalidateQueries({ queryKey: ["group", item.groupId, "dashboard"] });
  },
};
