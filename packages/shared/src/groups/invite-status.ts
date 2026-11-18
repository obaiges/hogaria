/** Estado calculado de una invitación (spec 02, RN-02-13). Nunca se guarda. */
export type InviteStatus = 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED';

export interface InviteStatusFields {
  revokedAt: Date | string | null;
  usedAt: Date | string | null;
  expiresAt: Date | string;
}

/** `REVOKED` > `USED` > `EXPIRED` (si `expiresAt <= now`) > `ACTIVE`. */
export function inviteStatus(invite: InviteStatusFields, now: Date = new Date()): InviteStatus {
  if (invite.revokedAt) return 'REVOKED';
  if (invite.usedAt) return 'USED';
  if (new Date(invite.expiresAt).getTime() <= now.getTime()) return 'EXPIRED';
  return 'ACTIVE';
}
