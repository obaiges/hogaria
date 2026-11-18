import { create } from 'zustand';

import type { LaneColor } from '@hogaria/shared';

/** Duración de la marca de onda (DESIGN.md §6, spec 03 RN-03-19). */
export const RIPPLE_DURATION_MS = 1_000;

interface Ripple {
  laneColor: LaneColor | null;
  /** Identifica la marca vigente: una marca nueva sobre la misma clave reinicia el temporizador. */
  token: number;
}

interface RippleState {
  ripples: Record<string, Ripple>;
}

export const useRippleStore = create<RippleState>(() => ({ ripples: {} }));

let nextToken = 0;

/**
 * Marca `entityKey` (`"<entityType>:<id>"`, p. ej. `"shopping_item:0193…"`) con la onda
 * del color de calle del autor durante `RIPPLE_DURATION_MS`. La llaman los manejadores a
 * través de `ctx.markRipple`, que ya filtra los cambios propios.
 */
export function markRipple(entityKey: string, laneColor: LaneColor | null): void {
  const token = ++nextToken;
  useRippleStore.setState((s) => ({ ripples: { ...s.ripples, [entityKey]: { laneColor, token } } }));
  setTimeout(() => {
    useRippleStore.setState((s) => {
      if (s.ripples[entityKey]?.token !== token) return s;
      const { [entityKey]: _expired, ...rest } = s.ripples;
      return { ripples: rest };
    });
  }, RIPPLE_DURATION_MS);
}

export function clearRipples(): void {
  useRippleStore.setState({ ripples: {} });
}

/**
 * Onda de una entidad: `{ active, laneColor }`. Se pasa a `Lane` (`highlight="ripple"`)
 * o a `useRippleClass(active, laneColor)` (HOG-009).
 */
export function useRipple(entityKey: string): { active: boolean; laneColor: LaneColor | null } {
  const ripple = useRippleStore((s) => s.ripples[entityKey]);
  return { active: ripple !== undefined, laneColor: ripple?.laneColor ?? null };
}
