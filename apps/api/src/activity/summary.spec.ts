import { describe, expect, it } from 'vitest';

import { quoteRename, truncateName, truncateText } from './summary.js';

describe('summary (RN-03-27)', () => {
  it('truncateName deja los nombres cortos tal cual', () => {
    expect(truncateName('Leche')).toBe('Leche');
    expect(truncateName('a'.repeat(60))).toBe('a'.repeat(60));
  });

  it('truncateName recorta a 60 con "…" incluido', () => {
    const out = truncateName('a'.repeat(61));
    expect(out).toBe(`${'a'.repeat(59)}…`);
    expect(Array.from(out)).toHaveLength(60);
  });

  it('truncateName acepta otro máximo y quita espacios sobrantes', () => {
    expect(truncateName('  Compra del mes  ', 8)).toBe('Compra…');
  });

  it('no parte emojis compuestos', () => {
    const family = '👨‍👩‍👧';
    expect(truncateText(`${family}${family}${family}`, 2)).toBe(`${family}…`);
  });

  it('quoteRename usa comillas angulares', () => {
    expect(quoteRename('Mercadona')).toBe('«Mercadona»');
    expect(quoteRename('x'.repeat(70))).toBe(`«${'x'.repeat(59)}…»`);
  });
});
