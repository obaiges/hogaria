/** Hora (0–23) del instante en la zona del grupo. */
export function hourInZone(timezone: string, now: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: timezone }).format(now);
  return Number(hour);
}

/** Spec 15 §7.2: días 06:00–13:59, tardes 14:00–20:59 y noches el resto, en la zona del grupo. */
export function greetingFor(name: string, timezone: string, now: Date = new Date()): string {
  const hour = hourInZone(timezone, now);
  const prefix = hour >= 6 && hour < 14 ? "Buenos días" : hour >= 14 && hour < 21 ? "Buenas tardes" : "Buenas noches";
  return `${prefix}, ${name}`;
}

/** "Miércoles, 11 de noviembre" del día `YYYY-MM-DD` (con mayúscula inicial). */
export function longDayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  // Mediodía UTC: el mismo día del calendario en cualquier zona.
  const text = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
  return text.charAt(0).toLocaleUpperCase("es") + text.slice(1);
}

export function Greeting({ name, date, timezone }: { name: string; date: string; timezone: string }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-[24px] font-semibold text-[var(--ink)]">{greetingFor(name, timezone)}</h1>
      <p className="font-sign text-[16px] font-medium uppercase tracking-[0.06em] text-[var(--ink-muted)]">{longDayLabel(date)}</p>
    </header>
  );
}
