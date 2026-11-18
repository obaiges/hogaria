/** Último hogar abierto (lo guarda el `GroupLayout`, RN-02-31). */
export const LAST_GROUP_KEY = "hogaria:lastGroupId";

export function readLastGroupId(): string | null {
  try {
    return localStorage.getItem(LAST_GROUP_KEY);
  } catch {
    return null;
  }
}

export function writeLastGroupId(groupId: string): void {
  try {
    localStorage.setItem(LAST_GROUP_KEY, groupId);
  } catch {
    // Sin almacenamiento (modo privado): solo se pierde el atajo.
  }
}

export function clearLastGroupId(): void {
  try {
    localStorage.removeItem(LAST_GROUP_KEY);
  } catch {
    // ignorar
  }
}

export interface LandingRoute {
  path: string;
  /** `lastGroupId` apunta a un grupo del que ya no es miembro: hay que borrarlo. */
  staleLastGroupId: boolean;
}

/**
 * RN-02-30: último hogar si sigue siendo miembro → `/g/:id`; si no, con un único hogar
 * → `/g/:id`; si no → `/grupos`.
 */
export function resolveLandingRoute(groups: ReadonlyArray<{ id: string }>, lastGroupId: string | null): LandingRoute {
  const lastIsMine = lastGroupId !== null && groups.some((g) => g.id === lastGroupId);
  const staleLastGroupId = lastGroupId !== null && !lastIsMine;
  if (lastIsMine) return { path: `/g/${lastGroupId}`, staleLastGroupId };
  const [only] = groups;
  if (groups.length === 1 && only) return { path: `/g/${only.id}`, staleLastGroupId };
  return { path: "/grupos", staleLastGroupId };
}
