import { describe, expect, it } from 'vitest';

import { formatMoney, parseMoney } from './money';

const NBSP = String.fromCharCode(0xa0);

describe('formatMoney', () => {
  it.each([
    [1234, `12,34${NBSP}€`],
    [0, `0,00${NBSP}€`],
    [5, `0,05${NBSP}€`],
    [123400, `1.234,00${NBSP}€`],
    [123456789, `1.234.567,89${NBSP}€`],
    [-500, `-5,00${NBSP}€`],
  ])('%i → %s', (cents, expected) => {
    expect(formatMoney(cents)).toBe(expected);
  });

  it('rechaza valores no enteros', () => {
    expect(() => formatMoney(12.5)).toThrow(RangeError);
    expect(() => formatMoney(Number.NaN)).toThrow(RangeError);
  });
});

describe('parseMoney', () => {
  it.each([
    ['12', 1200],
    ['12,3', 1230],
    ['12,34', 1234],
    ['0,05', 5],
    ['1234,56', 123456],
    ['1.234', 123400],
    ['12.345,67', 1234567],
    ['12.5', 1250],
    ['12.34', 1234],
    [' 12,34 € ', 1234],
    [`64,20${NBSP}€`, 6420],
  ])('"%s" → %i', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it.each([
    '',
    '€',
    '-5',
    '-5,00',
    '12,345',
    '12.3456',
    '1.23.4',
    'abc',
    '12,',
    ',5',
    '1,2,3',
    '12.34.56',
  ])('"%s" → null', (input) => {
    expect(parseMoney(input)).toBeNull();
  });

  it('es inversa de formatMoney', () => {
    for (const cents of [0, 1, 99, 1234, 99999, 123456789]) {
      expect(parseMoney(formatMoney(cents))).toBe(cents);
    }
  });

  it('rechaza importes fuera del rango seguro', () => {
    expect(parseMoney('99999999999999999999')).toBeNull();
  });
});
