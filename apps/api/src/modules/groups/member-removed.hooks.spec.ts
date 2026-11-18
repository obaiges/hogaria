import { describe, expect, it } from 'vitest';

import { MemberRemovedHooks } from './member-removed.hooks.js';

import type { Prisma } from '@prisma/client';

const tx = {} as Prisma.TransactionClient;
const ctx = { groupId: 'g', userId: 'u' };

describe('MemberRemovedHooks (RN-02-22)', () => {
  it('sin manejadores no hace nada', async () => {
    await expect(new MemberRemovedHooks().run(tx, ctx)).resolves.toBeUndefined();
  });

  it('ejecuta los manejadores en orden de registro con la transacción y el contexto', async () => {
    const hooks = new MemberRemovedHooks();
    const calls: string[] = [];
    hooks.register({ name: 'a', onMemberRemoved: async (t, c) => void calls.push(`a:${c.groupId}:${c.userId}:${t === tx}`) });
    hooks.register({ name: 'b', onMemberRemoved: async () => void calls.push('b') });
    await hooks.run(tx, ctx);
    expect(calls).toEqual(['a:g:u:true', 'b']);
  });

  it('un fallo se propaga (deshace la transacción) y no ejecuta los siguientes', async () => {
    const hooks = new MemberRemovedHooks();
    const calls: string[] = [];
    hooks.register({ name: 'falla', onMemberRemoved: () => Promise.reject(new Error('boom')) });
    hooks.register({ name: 'b', onMemberRemoved: async () => void calls.push('b') });
    await expect(hooks.run(tx, ctx)).rejects.toThrow('boom');
    expect(calls).toEqual([]);
  });
});
