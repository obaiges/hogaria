import { describe, expect, it } from 'vitest';

import { inviteStatus } from './invite-status';

const now = new Date('2026-11-18T10:00:00Z');
const future = '2026-11-28T10:00:00Z';
const past = '2026-11-08T10:00:00Z';

describe('inviteStatus (RN-02-13)', () => {
  it('ACTIVE si no está revocada, ni usada, ni caducada', () => {
    expect(inviteStatus({ revokedAt: null, usedAt: null, expiresAt: future }, now)).toBe('ACTIVE');
  });

  it('EXPIRED si expiresAt <= now (incluido el instante exacto)', () => {
    expect(inviteStatus({ revokedAt: null, usedAt: null, expiresAt: past }, now)).toBe('EXPIRED');
    expect(inviteStatus({ revokedAt: null, usedAt: null, expiresAt: now }, now)).toBe('EXPIRED');
  });

  it('USED gana a EXPIRED', () => {
    expect(inviteStatus({ revokedAt: null, usedAt: past, expiresAt: past }, now)).toBe('USED');
  });

  it('REVOKED gana a USED y a EXPIRED', () => {
    expect(inviteStatus({ revokedAt: past, usedAt: past, expiresAt: past }, now)).toBe('REVOKED');
    expect(inviteStatus({ revokedAt: new Date(past), usedAt: null, expiresAt: future }, now)).toBe('REVOKED');
  });
});
