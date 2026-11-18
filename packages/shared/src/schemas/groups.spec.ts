import { describe, expect, it } from 'vitest';

import { pickLaneColor } from '../groups/lane-colors';
import { createGroupInput, groupEmojiSchema, groupNameSchema, timezoneSchema, updateGroupInput } from './groups';

describe('pickLaneColor (RN-02-07)', () => {
  it('sin colores en uso → CORAL', () => {
    expect(pickLaneColor([])).toBe('CORAL');
  });

  it('el primer color libre en orden', () => {
    expect(pickLaneColor(['CORAL'])).toBe('SEA');
    expect(pickLaneColor(['CORAL', 'SUN'])).toBe('SEA');
    expect(pickLaneColor(['SEA', 'CORAL', 'SUN'])).toBe('LEAF');
  });

  it('con los 8 en uso → el menos usado', () => {
    const all = ['CORAL', 'SEA', 'SUN', 'LEAF', 'VIOLET', 'ROSE', 'ORANGE', 'SLATE'] as const;
    expect(pickLaneColor([...all, 'CORAL', 'SEA'])).toBe('SUN');
  });

  it('empate entre los menos usados → el primero en el orden', () => {
    const all = ['CORAL', 'SEA', 'SUN', 'LEAF', 'VIOLET', 'ROSE', 'ORANGE', 'SLATE'] as const;
    expect(pickLaneColor([...all])).toBe('CORAL');
    expect(pickLaneColor([...all, 'CORAL'])).toBe('SEA');
  });
});

describe('groupEmojiSchema (RN-02-01)', () => {
  it.each(['🏠', '🐶', '👨‍👩‍👧', '🇪🇸', '❤️', '👍🏽'])('acepta %s (un solo emoji)', (emoji) => {
    expect(groupEmojiSchema.safeParse(emoji).success).toBe(true);
  });

  it.each(['🏠🏠', 'a', 'Casa', '', '1', '🏠 '.repeat(2)])('rechaza %j', (value) => {
    expect(groupEmojiSchema.safeParse(value).success).toBe(false);
  });
});

describe('timezoneSchema', () => {
  it.each(['Europe/Madrid', 'Atlantic/Canary', 'America/Mexico_City', 'UTC'])('acepta %s', (tz) => {
    expect(timezoneSchema.safeParse(tz).success).toBe(true);
  });

  it.each(['Europe/Nowhere', 'Madrid', '', '+02:00'])('rechaza %j', (tz) => {
    expect(timezoneSchema.safeParse(tz).success).toBe(false);
  });
});

describe('createGroupInput y updateGroupInput', () => {
  it('nombre 1–40 tras trim', () => {
    expect(groupNameSchema.parse('  Casa  ')).toBe('Casa');
    expect(groupNameSchema.safeParse('   ').success).toBe(false);
    expect(groupNameSchema.safeParse('x'.repeat(41)).success).toBe(false);
  });

  it('emoji 🏠 y Europe/Madrid por defecto', () => {
    expect(createGroupInput.parse({ name: 'Casa' })).toEqual({ name: 'Casa', emoji: '🏠', timezone: 'Europe/Madrid' });
  });

  it('update exige al menos un campo', () => {
    expect(updateGroupInput.safeParse({}).success).toBe(false);
    expect(updateGroupInput.parse({ emoji: '🐶' })).toEqual({ emoji: '🐶' });
  });
});
