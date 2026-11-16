/**
 * Fechas en la zona horaria del grupo (ADR-013).
 * - Instantes: `Date` o ISO UTC.
 * - Días de calendario: `"YYYY-MM-DD"` interpretados en la zona del grupo.
 * Nunca uses `new Date().getDay()` a pelo en la app: usa estas utilidades.
 */
import { TZDate } from '@date-fns/tz';
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

export const DEFAULT_TIMEZONE = 'Europe/Madrid';

/** Día de calendario `"YYYY-MM-DD"`. */
export type IsoDay = string;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(value: string): value is IsoDay {
  if (!ISO_DAY.test(value)) return false;
  const d = parseISO(value);
  return !Number.isNaN(d.getTime()) && format(d, 'yyyy-MM-dd') === value;
}

function assertIsoDay(day: string): void {
  if (!isIsoDay(day)) throw new RangeError(`Día no válido: "${day}" (se espera YYYY-MM-DD)`);
}

function toInstant(value: Date | string): Date {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) throw new RangeError(`Instante no válido: ${String(value)}`);
  return d;
}

/** Día local `"YYYY-MM-DD"` de un instante en la zona `tz`. */
export function toZonedDay(instant: Date | string, tz: string = DEFAULT_TIMEZONE): IsoDay {
  return format(new TZDate(toInstant(instant).getTime(), tz), 'yyyy-MM-dd');
}

/** Hoy en la zona `tz`. `now` es inyectable para tests. */
export function todayInZone(tz: string = DEFAULT_TIMEZONE, now: Date = new Date()): IsoDay {
  return toZonedDay(now, tz);
}

/**
 * Rango UTC `[start, end)` que cubre el día local `day` en la zona `tz`.
 * Tiene 23 o 25 horas los días de cambio de hora.
 */
export function zonedDayToUtcRange(
  day: IsoDay,
  tz: string = DEFAULT_TIMEZONE,
): { start: Date; end: Date } {
  assertIsoDay(day);
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const start = new TZDate(y, m - 1, d, 0, 0, 0, 0, tz);
  const next = addDays(start, 1);
  return { start: new Date(start.getTime()), end: new Date(next.getTime()) };
}

/** Instante UTC de una hora local `"HH:mm"` en el día `day` de la zona `tz`. */
export function zonedDateTimeToUtc(day: IsoDay, time: string, tz: string = DEFAULT_TIMEZONE): Date {
  assertIsoDay(day);
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new RangeError(`Hora no válida: "${time}" (se espera HH:mm)`);
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(new TZDate(y, m - 1, d, Number(match[1]), Number(match[2]), 0, 0, tz).getTime());
}

/** Suma `amount` días a un día de calendario (sin depender de zona). */
export function addDaysToIsoDay(day: IsoDay, amount: number): IsoDay {
  assertIsoDay(day);
  return format(addDays(parseISO(day), amount), 'yyyy-MM-dd');
}

/**
 * Lunes de la semana que contiene `day`. Acepta un día `"YYYY-MM-DD"` o un instante
 * (que se convierte primero al día local en `tz`).
 */
export function startOfWeekInZone(day: IsoDay | Date, tz: string = DEFAULT_TIMEZONE): IsoDay {
  const isoDay = day instanceof Date ? toZonedDay(day, tz) : day;
  assertIsoDay(isoDay);
  return format(startOfWeek(parseISO(isoDay), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/** "mié 11 nov". Acepta un día `"YYYY-MM-DD"` o un instante (en la zona `tz`). */
export function formatDayShort(value: IsoDay | Date, tz: string = DEFAULT_TIMEZONE): string {
  const isoDay = value instanceof Date ? toZonedDay(value, tz) : value;
  assertIsoDay(isoDay);
  return format(parseISO(isoDay), 'EEE d MMM', { locale: es }).replace(/\./g, '');
}

/** "HH:mm" de un instante en la zona `tz`. */
export function formatTime(instant: Date | string, tz: string = DEFAULT_TIMEZONE): string {
  return format(new TZDate(toInstant(instant).getTime(), tz), 'HH:mm');
}

/**
 * "08:00–15:00" (raya corta U+2013). Acepta horas locales `"HH:mm"` o instantes (en la zona `tz`).
 */
export function formatTimeRange(
  start: string | Date,
  end: string | Date,
  tz: string = DEFAULT_TIMEZONE,
): string {
  const asTime = (v: string | Date) =>
    typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : formatTime(v, tz);
  return `${asTime(start)}–${asTime(end)}`;
}

/**
 * Tiempo relativo en español: "ahora", "hace 5 min", "hace 2 h", "ayer", "hace 3 días",
 * y a partir de 7 días la fecha corta. Nunca devuelve un tiempo futuro ("ahora" si el reloj
 * del cliente va por detrás).
 */
export function formatRelative(
  instant: Date | string,
  now: Date = new Date(),
  tz: string = DEFAULT_TIMEZONE,
): string {
  const then = toInstant(instant);
  const seconds = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));
  if (seconds < 60) return 'ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = differenceInCalendarDays(
    parseISO(toZonedDay(now, tz)),
    parseISO(toZonedDay(then, tz)),
  );
  if (days <= 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return formatDayShort(then, tz);
}
