import { describe, expect, it } from 'vitest';

import {
  AISLE_LABELS,
  AISLES,
  ALLERGEN_LABELS,
  ALLERGENS,
  DEFAULT_EXPENSE_CATEGORIES,
  DIET_LABELS,
  DIETS,
  INVITE_TTL_DAYS,
  LANE_COLOR_ORDER,
  LANE_COLOR_TOKEN,
  MAX_GROUP_MEMBERS,
  MEAL_SLOT_LABELS,
  MEAL_SLOTS,
  UNITS,
} from './index';

describe('constantes', () => {
  it('valores fijados en la documentación', () => {
    expect(INVITE_TTL_DAYS).toBe(10);
    expect(MAX_GROUP_MEMBERS).toBe(20);
    expect(LANE_COLOR_ORDER).toEqual([
      'CORAL',
      'SEA',
      'SUN',
      'LEAF',
      'VIOLET',
      'ROSE',
      'ORANGE',
      'SLATE',
    ]);
    expect(ALLERGENS).toHaveLength(14);
    expect(MEAL_SLOTS).toHaveLength(5);
    expect(DEFAULT_EXPENSE_CATEGORIES).toHaveLength(9);
    expect(UNITS).toContain('ud');
  });

  it('cada valor tiene su etiqueta en español', () => {
    for (const a of AISLES) expect(AISLE_LABELS[a]).toBeTruthy();
    for (const a of ALLERGENS) expect(ALLERGEN_LABELS[a]).toBeTruthy();
    for (const d of DIETS) expect(DIET_LABELS[d]).toBeTruthy();
    for (const s of MEAL_SLOTS) expect(MEAL_SLOT_LABELS[s]).toBeTruthy();
    for (const c of LANE_COLOR_ORDER) expect(LANE_COLOR_TOKEN[c]).toMatch(/^--lane-/);
  });

  it('las categorías por defecto tienen nombres únicos', () => {
    const names = DEFAULT_EXPENSE_CATEGORIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
