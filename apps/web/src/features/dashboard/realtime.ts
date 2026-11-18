import type { RealtimeHandler, RealtimeHandlers } from "@/lib/realtime/handlers";
import type { DashboardDto, RealtimeEventName } from "@hogaria/shared";
import type { QueryClient } from "@tanstack/react-query";

/** Onda de una calle del Inicio (por `userId`). */
export const laneRippleKey = (userId: string) => `lane:${userId}`;

const RECENT_ACTIVITY = 5;

/** Todas las fechas en caché del Inicio de un grupo: `['group', g, 'dashboard', *]`. */
const dashboardOf = (groupId: string) => ["group", groupId, "dashboard"];

function invalidateDashboard(queryClient: QueryClient, groupId: string | null): void {
  if (groupId) void queryClient.invalidateQueries({ queryKey: dashboardOf(groupId) });
}

/** Miembros y datos del hogar: se vuelve a pedir el Inicio (spec 15 §6). */
const invalidate: RealtimeHandler<RealtimeEventName> = ({ groupId }, { queryClient }) => invalidateDashboard(queryClient, groupId);

/** Manejadores del Inicio (spec 15 §6). Conviven con los de Actividad y Grupos para los mismos eventos. */
export const dashboardHandlers: RealtimeHandlers = {
  // La entrada nueva arriba y como mucho 5, sin duplicar por id ni crear la query.
  "activity.created": ({ data: item }, { queryClient }) => {
    queryClient.setQueriesData<DashboardDto>({ queryKey: dashboardOf(item.groupId) }, (old) => {
      if (!old || old.activity.some((a) => a.id === item.id)) return old;
      return { ...old, activity: [item, ...old.activity].slice(0, RECENT_ACTIVITY) };
    });
  },
  "group.updated": invalidate,
  "group.member.left": invalidate,
  "group.member.joined": (envelope, ctx) => {
    invalidateDashboard(ctx.queryClient, envelope.groupId);
    ctx.markRipple(laneRippleKey(envelope.data.userId));
  },
  "group.member.updated": (envelope, ctx) => {
    invalidateDashboard(ctx.queryClient, envelope.groupId);
    ctx.markRipple(laneRippleKey(envelope.data.userId));
  },
};
