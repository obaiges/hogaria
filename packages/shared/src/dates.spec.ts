import { describe, expect, it } from 'vitest';

import {
  addDaysToIsoDay,
  DEFAULT_TIMEZONE,
  formatDayShort,
  formatRelative,
  formatTime,
  formatTimeRange,
  isIsoDay,
  startOfWeekInZone,
  todayInZone,
  toZonedDay,
  zonedDateTimeToUtc,
  zonedDayToUtcRange,
} from './dates';

const HOUR = 3_600_000;

describe('zona por defecto', () => {
  it('es Europe/Madrid', () => {
    expect(DEFAULT_TIMEZONE).toBe('Europe/Madrid');
  });
});

describe('isIsoDay', () => {
  it('valida días reales', () => {
    expect(isIsoDay('2026-11-11')).toBe(true);
    expect(isIsoDay('2028-02-29')).toBe(true);
    expect(isIsoDay('2026-02-29')).toBe(false);
    expect(isIsoDay('2026-13-01')).toBe(false);
    expect(isIsoDay('11/11/2026')).toBe(false);
  });
});

describe('toZonedDay / todayInZone', () => {
  it('usa el día local, no el UTC', () => {
    // 23:30 UTC del 11 = 00:30 del 12 en Madrid (invierno, UTC+1)
    expect(toZonedDay('2026-11-11T23:30:00Z', 'Europe/Madrid')).toBe('2026-11-12');
    expect(toZonedDay('2026-11-11T23:30:00Z', 'Atlantic/Canary')).toBe('2026-11-11');
    expect(todayInZone('Europe/Madrid', new Date('2026-11-11T23:30:00Z'))).toBe('2026-11-12');
  });

  it('rechaza instantes inválidos', () => {
    expect(() => toZonedDay('no-es-fecha')).toThrow(RangeError);
  });
});

describe('zonedDayToUtcRange', () => {
  it('día normal de invierno: 24 h desde las 23:00 UTC del día anterior', () => {
    const { start, end } = zonedDayToUtcRange('2026-11-11', 'Europe/Madrid');
    expect(start.toISOString()).toBe('2026-11-10T23:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-11T23:00:00.000Z');
  });

  it('cambio de hora de marzo (29/03/2026): el día dura 23 h', () => {
    const { start, end } = zonedDayToUtcRange('2026-03-29', 'Europe/Madrid');
    expect(start.toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(23 * HOUR);
  });

  it('cambio de hora de octubre (25/10/2026): el día dura 25 h', () => {
    const { start, end } = zonedDayToUtcRange('2026-10-25', 'Europe/Madrid');
    expect(start.toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(25 * HOUR);
  });

  it('Canarias va una hora por detrás', () => {
    expect(zonedDayToUtcRange('2026-11-11', 'Atlantic/Canary').start.toISOString()).toBe(
      '2026-11-11T00:00:00.000Z',
    );
  });

  it('rechaza días inválidos', () => {
    expect(() => zonedDayToUtcRange('2026-02-30')).toThrow(RangeError);
  });
});

describe('zonedDateTimeToUtc', () => {
  it('convierte hora local de verano e invierno', () => {
    expect(zonedDateTimeToUtc('2026-07-01', '08:00').toISOString()).toBe(
      '2026-07-01T06:00:00.000Z',
    );
    expect(zonedDateTimeToUtc('2026-11-11', '08:00').toISOString()).toBe(
      '2026-11-11T07:00:00.000Z',
    );
  });

  it('rechaza horas mal formadas', () => {
    expect(() => zonedDateTimeToUtc('2026-11-11', '8:00')).toThrow(RangeError);
    expect(() => zonedDateTimeToUtc('2026-11-11', '24:00')).toThrow(RangeError);
  });
});

describe('addDaysToIsoDay', () => {
  it('cruza meses, años y el cambio de hora', () => {
    expect(addDaysToIsoDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToIsoDay('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDaysToIsoDay('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('startOfWeekInZone', () => {
  it('la semana empieza en lunes', () => {
    expect(startOfWeekInZone('2026-11-11')).toBe('2026-11-09'); // miércoles → lunes
    expect(startOfWeekInZone('2026-11-09')).toBe('2026-11-09'); // lunes
    expect(startOfWeekInZone('2026-11-15')).toBe('2026-11-09'); // domingo → lunes anterior
  });

  it('con un instante usa el día local', () => {
    // Domingo 15 a las 23:30 UTC = lunes 16 a las 00:30 en Madrid
    expect(startOfWeekInZone(new Date('2026-11-15T23:30:00Z'), 'Europe/Madrid')).toBe('2026-11-16');
  });
});

describe('formatos', () => {
  it('formatDayShort → "mié 11 nov"', () => {
    expect(formatDayShort('2026-11-11')).toBe('mié 11 nov');
    expect(formatDayShort(new Date('2026-11-11T23:30:00Z'))).toBe('jue 12 nov');
  });

  it('formatTime y formatTimeRange', () => {
    expect(formatTime('2026-11-11T07:00:00Z')).toBe('08:00');
    expect(formatTimeRange('08:00', '15:00')).toBe('08:00–15:00');
    expect(
      formatTimeRange(new Date('2026-07-01T06:00:00Z'), new Date('2026-07-01T13:00:00Z')),
    ).toBe('08:00–15:00');
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it.each([
    [10_000, 'ahora'],
    [5 * 60_000, 'hace 5 min'],
    [2 * HOUR, 'hace 2 h'],
    [26 * HOUR, 'ayer'],
    [3 * 24 * HOUR, 'hace 3 días'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatRelative(ago(ms), now)).toBe(expected);
  });

  it('a partir de 7 días muestra la fecha', () => {
    expect(formatRelative(ago(10 * 24 * HOUR), now)).toBe('dom 1 nov');
  });

  it('nunca devuelve tiempo futuro', () => {
    expect(formatRelative(new Date(now.getTime() + 60 * 60_000), now)).toBe('ahora');
  });
});
