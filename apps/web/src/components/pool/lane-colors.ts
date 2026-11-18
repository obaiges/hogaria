import { LANE_COLOR_TOKEN, type LaneColor } from "@hogaria/shared";

/** `laneColorVar('CORAL')` → `var(--lane-coral)` (DESIGN.md §3). */
export function laneColorVar(color: LaneColor): string {
  return `var(${LANE_COLOR_TOKEN[color]})`;
}

/** Color de las calles y avatares sin miembro (sistema, ex-miembro o "Usuario eliminado"). */
export const NEUTRAL_LANE_VAR = "var(--agua-400)";

/** Nombre en español de cada color de calle (glosario, `docs/10-glosario.md`). */
export const LANE_COLOR_LABEL: Record<LaneColor, string> = {
  CORAL: "Coral",
  SEA: "Mar",
  SUN: "Sol",
  LEAF: "Hoja",
  VIOLET: "Violeta",
  ROSE: "Rosa",
  ORANGE: "Naranja",
  SLATE: "Pizarra",
};
