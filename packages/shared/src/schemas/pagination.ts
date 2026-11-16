/**
 * Paginación por cursor (docs/04 §Convenciones REST).
 * El cursor es OPACO para el cliente: base64url de un JSON con la tupla de orden
 * (por defecto `[id]`; p. ej. gastos usa `[date, id]`). Solo el servidor lo decodifica.
 */
import { z } from 'zod';

export const PAGE_LIMIT_DEFAULT = 50;
export const PAGE_LIMIT_MAX = 100;

export const cursorQuery = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
});
export type CursorQuery = z.infer<typeof cursorQuery>;

export function paginated<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
  });
}
export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

type CursorPart = string | number;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** `["2026-11-11", "0193…"]` → cursor opaco. */
export function encodeCursor(parts: readonly CursorPart[]): string {
  return toBase64Url(JSON.stringify(parts));
}

/**
 * Cursor opaco → tupla. Devuelve `null` si está corrupto o no tiene `expectedLength` partes
 * (el servidor responde entonces `422 VALIDATION_ERROR`).
 */
export function decodeCursor(cursor: string, expectedLength = 1): CursorPart[] | null {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(cursor));
    if (
      Array.isArray(parsed) &&
      parsed.length === expectedLength &&
      parsed.every((p) => typeof p === 'string' || typeof p === 'number')
    ) {
      return parsed as CursorPart[];
    }
    return null;
  } catch {
    return null;
  }
}
