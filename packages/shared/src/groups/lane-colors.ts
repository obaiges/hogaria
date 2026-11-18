import { LANE_COLOR_ORDER, type LaneColor } from '../constants/index.js';

/**
 * Color de calle para un miembro nuevo (spec 02, RN-02-07): el primero de
 * `LANE_COLOR_ORDER` que no use nadie; si están todos en uso, el **menos usado** y, a
 * igualdad, el primero en ese orden.
 */
export function pickLaneColor(inUse: readonly LaneColor[]): LaneColor {
  const counts = new Map<LaneColor, number>(LANE_COLOR_ORDER.map((c) => [c, 0]));
  for (const color of inUse) counts.set(color, (counts.get(color) ?? 0) + 1);

  let best: LaneColor = LANE_COLOR_ORDER[0];
  for (const color of LANE_COLOR_ORDER) {
    if ((counts.get(color) ?? 0) < (counts.get(best) ?? 0)) best = color;
  }
  return best;
}
