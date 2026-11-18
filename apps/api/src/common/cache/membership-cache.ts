import { Injectable } from '@nestjs/common';

import type { LaneColor } from '@prisma/client';

/** Pertenencia de un usuario a un grupo, tal como la necesita el `GroupMemberGuard`. */
export interface Membership {
  memberId: string;
  laneColor: LaneColor;
  timezone: string;
}

interface Entry {
  /** `null` = no es miembro (o el grupo no existe): también se cachea. */
  value: Membership | null;
  expiresAt: number;
}

export const MEMBERSHIP_CACHE_TTL_MS = 60_000;
/** Por encima de este tamaño, cada escritura barre las entradas caducadas. */
const SWEEP_THRESHOLD = 5_000;

const key = (userId: string, groupId: string) => `${userId}:${groupId}`;

/**
 * Caché en memoria de la pertenencia a grupos (RN-02-26): 60 s por `userId:groupId`,
 * tanto positivos como negativos. Es un singleton por proceso (una sola instancia de API).
 *
 * Invalidar:
 * - `invalidate(userId, groupId)`: alta, salida o expulsión de un miembro, cambio de color.
 * - `invalidateGroup(groupId)`: cambio de zona horaria o borrado del grupo.
 */
@Injectable()
export class MembershipCache {
  private readonly entries = new Map<string, Entry>();

  /** `undefined` = no está en caché (o ha caducado); `null` = no es miembro. */
  get(userId: string, groupId: string): Membership | null | undefined {
    const k = key(userId, groupId);
    const entry = this.entries.get(k);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(k);
      return undefined;
    }
    return entry.value;
  }

  set(userId: string, groupId: string, value: Membership | null): void {
    if (this.entries.size >= SWEEP_THRESHOLD) this.sweep();
    this.entries.set(key(userId, groupId), { value, expiresAt: Date.now() + MEMBERSHIP_CACHE_TTL_MS });
  }

  invalidate(userId: string, groupId: string): void {
    this.entries.delete(key(userId, groupId));
  }

  invalidateGroup(groupId: string): void {
    const suffix = `:${groupId}`;
    for (const k of this.entries.keys()) {
      if (k.endsWith(suffix)) this.entries.delete(k);
    }
  }

  /** Número de entradas (incluidas las caducadas aún no barridas). Para tests. */
  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [k, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(k);
    }
  }
}
