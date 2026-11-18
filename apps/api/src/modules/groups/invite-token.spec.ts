import { describe, expect, it } from 'vitest';

import { generateInviteToken, hashInviteToken, redactInviteToken } from './invite-token.js';

describe('invite-token (RN-02-10)', () => {
  it('generateInviteToken: 43 caracteres base64url y distintos cada vez', () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('hashInviteToken: SHA-256 en hexadecimal, determinista', () => {
    expect(hashInviteToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hashInviteToken('abc')).toBe(hashInviteToken('abc'));
    expect(hashInviteToken('abd')).not.toBe(hashInviteToken('abc'));
  });

  it('redactInviteToken quita el token de las rutas para los logs', () => {
    expect(redactInviteToken('/api/v1/invites/AbC_-123')).toBe('/api/v1/invites/[redacted]');
    expect(redactInviteToken('/api/v1/invites/AbC/accept?x=1')).toBe('/api/v1/invites/[redacted]/accept?x=1');
    expect(redactInviteToken('/api/v1/groups/g1/invites')).toBe('/api/v1/groups/g1/invites');
    expect(redactInviteToken('/api/v1/groups/g1/invites/0193-id')).toBe('/api/v1/groups/g1/invites/[redacted]');
  });
});
