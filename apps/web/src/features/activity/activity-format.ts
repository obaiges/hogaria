import type { ActivityDto } from "@hogaria/shared";

/** `YYYY-MM-DD` del instante en la zona del hogar. */
export function dayKey(iso: string | Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone }).format(new Date(iso));
}

/** Día anterior a `YYYY-MM-DD` (calendario, sin depender de la zona ni del cambio de hora). */
function previousDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d - 1));
  return date.toISOString().slice(0, 10);
}

/** RN-03-32: "Hoy", "Ayer" o "lunes 9 de noviembre" (con el año si no es el actual). */
export function dayLabel(key: string, timezone: string, now: Date = new Date()): string {
  const today = dayKey(now, timezone);
  if (key === today) return "Hoy";
  if (key === previousDay(today)) return "Ayer";
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  // Mediodía UTC: el mismo día del calendario en cualquier zona.
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  })
    .format(noon)
    .replace(",", "");
}

/** RN-03-32: hoy, hora relativa ("ahora mismo", "hace 5 min", "hace 2 h"); otros días, "HH:mm". */
export function timeLabel(iso: string, timezone: string, now: Date = new Date()): string {
  if (dayKey(iso, timezone) === dayKey(now, timezone)) {
    const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
    if (minutes < 1) return "ahora mismo";
    if (minutes < 60) return `hace ${minutes} min`;
    return `hace ${Math.floor(minutes / 60)} h`;
  }
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(new Date(iso));
}

export interface ActivityDay {
  key: string;
  label: string;
  items: ActivityDto[];
}

/** Agrupa por día en la zona del hogar, conservando el orden (más reciente primero). */
export function groupByDay(items: readonly ActivityDto[], timezone: string, now: Date = new Date()): ActivityDay[] {
  const days: ActivityDay[] = [];
  for (const item of items) {
    const key = dayKey(item.createdAt, timezone);
    const last = days[days.length - 1];
    if (last && last.key === key) last.items.push(item);
    else days.push({ key, label: dayLabel(key, timezone, now), items: [item] });
  }
  return days;
}

/** RN-03-28: quién lo hizo. `null` = sistema (sin actor). */
export function actorLabel(item: Pick<ActivityDto, "actorId" | "actorName">): string | null {
  if (item.actorId === null) return null;
  return item.actorName ?? "Usuario eliminado";
}

/** RN-03-28: el `summary` del sistema va con la inicial en mayúscula. */
export function systemSummary(summary: string): string {
  return summary.charAt(0).toLocaleUpperCase("es") + summary.slice(1);
}
