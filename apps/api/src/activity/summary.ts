/**
 * Utilidades para los `summary` de actividad (spec 03, RN-03-27). Cada módulo define sus
 * textos en `modules/<x>/<x>.activity.ts` con estas funciones: español, pretérito perfecto
 * simple, tercera persona, sin el nombre del actor y en minúscula inicial
 * ("añadió Leche a Compra").
 */

export const ACTIVITY_NAME_MAX = 60;
const ELLIPSIS = '…';

const segmenter = new Intl.Segmenter('es', { granularity: 'grapheme' });

/** Recorta a `max` grafemas (sin partir emojis compuestos), con "…" al final si sobra. */
export function truncateText(text: string, max: number): string {
  const graphemes = Array.from(segmenter.segment(text), (s) => s.segment);
  if (graphemes.length <= max) return text;
  return `${graphemes.slice(0, Math.max(0, max - 1)).join('').trimEnd()}${ELLIPSIS}`;
}

/** Nombre escrito por un usuario, tal cual pero recortado a 60 caracteres con "…". */
export function truncateName(name: string, max = ACTIVITY_NAME_MAX): string {
  return truncateText(name.trim(), max);
}

/** Solo para renombrados: `«nombre»` (recortado como `truncateName`). */
export function quoteRename(name: string): string {
  return `«${truncateName(name)}»`;
}
