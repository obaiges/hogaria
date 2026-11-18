import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { dashboardDto, todayInZone, zonedDayToUtcRange, type DashboardDto } from "@hogaria/shared";

import { api } from "@/lib/apiClient";

/** `['group', g, 'dashboard', date]` (spec 15 §6). */
export const dashboardKey = (groupId: string, date: string) => ["group", groupId, "dashboard", date] as const;

/** `GET /groups/:g/dashboard?date=` (RN-15-19): la web siempre envía el día de hoy en la zona del grupo. */
export function dashboardQuery(groupId: string, date: string) {
  return queryOptions({
    queryKey: dashboardKey(groupId, date),
    queryFn: () => api.get<DashboardDto>(`/groups/${groupId}/dashboard?date=${date}`, { schema: dashboardDto }),
    refetchOnWindowFocus: true,
  });
}

/** Milisegundos hasta la próxima medianoche de la zona (23 o 25 h los días de cambio de hora). */
export function msUntilNextDay(timezone: string, now: Date = new Date()): number {
  const { end } = zonedDayToUtcRange(todayInZone(timezone, now), timezone);
  return Math.max(1_000, end.getTime() - now.getTime() + 1_000);
}

/**
 * Hoy en la zona del grupo; cambia solo a la medianoche local (RN-15-30), lo que cambia la
 * clave de la query y hace que el Inicio pase al día nuevo sin recargar.
 */
export function useTodayInZone(timezone: string): string {
  // El día se calcula en cada render; el temporizador solo fuerza uno nuevo a la medianoche local.
  const [, setTick] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setTick((n) => n + 1);
        schedule();
      }, msUntilNextDay(timezone));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [timezone]);
  return todayInZone(timezone);
}

export function useDashboard(groupId: string, timezone: string) {
  const date = useTodayInZone(timezone);
  return { date, query: useQuery(dashboardQuery(groupId, date)) };
}
