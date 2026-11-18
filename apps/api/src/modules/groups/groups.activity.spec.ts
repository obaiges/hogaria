import { describe, expect, it } from 'vitest';

import { groupActivity } from './groups.activity.js';

const group = { name: 'Casa Baiges', emoji: '🏠', timezone: 'Atlantic/Canary' };

describe('textos de actividad de grupos (spec 02 §9)', () => {
  it('crear', () => {
    expect(groupActivity.created(group)).toBe('creó el hogar 🏠 Casa Baiges');
    expect(groupActivity.created({ ...group, name: 'x'.repeat(70) })).toBe(`creó el hogar 🏠 ${'x'.repeat(59)}…`);
  });

  it('editar un solo campo', () => {
    expect(groupActivity.updated(group, ['name'])).toBe('cambió el nombre del hogar a «Casa Baiges»');
    expect(groupActivity.updated(group, ['emoji'])).toBe('cambió el emoji del hogar a 🏠');
    expect(groupActivity.updated(group, ['timezone'])).toBe('cambió la zona horaria del hogar a Atlantic/Canary');
  });

  it('editar varios campos', () => {
    expect(groupActivity.updated(group, ['name', 'emoji'])).toBe('actualizó los datos del hogar');
  });
});
