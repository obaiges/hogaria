/** Utilidades puras de navegación (spec 15, HOG-750). */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un `groupId` mal formado pinta "No encontrado" sin llamar a la API (spec 15 §10). */
export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * RN-15-09: `?volver=` solo se respeta si es una ruta interna: empieza por `/`, no por `//`
 * y no contiene `://` ni barras invertidas (evita redirecciones abiertas).
 */
export function isSafeReturnTo(value: string | null | undefined): value is string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return false;
  return !value.includes("://") && !value.includes("\\");
}

/**
 * RN-15-10: al cambiar de hogar se conserva solo el primer segmento tras `/g/:groupId`
 * (`/g/A/compra/LIST` → `/g/B/compra`). Desde fuera de un hogar (`/perfil`, `/admin`) → `/g/B`.
 */
export function switchGroupPath(pathname: string, nextGroupId: string): string {
  const match = /^\/g\/[^/]+(?:\/([^/?#]+))?/.exec(pathname);
  const section = match?.[1];
  return section ? `/g/${nextGroupId}/${section}` : `/g/${nextGroupId}`;
}

/**
 * Hogar del shell (RN-15-12): el de la URL si es uno de los míos; fuera de `/g/**`
 * (`/perfil`, `/admin`), el último abierto si sigo siendo miembro o, si no, el primero.
 * `null` = sin barra inferior (grupo ajeno o usuario sin hogares).
 */
export function resolveShellGroupId(
  routeGroupId: string | undefined,
  myGroupIds: readonly string[],
  lastGroupId: string | null,
): string | null {
  if (routeGroupId !== undefined) return myGroupIds.includes(routeGroupId) ? routeGroupId : null;
  if (lastGroupId && myGroupIds.includes(lastGroupId)) return lastGroupId;
  return myGroupIds[0] ?? null;
}
