import { beforeEach, describe, expect, it } from 'vitest';

import { clearMutations, hasMutation, MAX_MUTATIONS, registerMutation } from './mutation-registry';

describe('mutation-registry (RN-03-16)', () => {
  beforeEach(() => clearMutations());

  it('registra y reconoce ids; null/undefined nunca coinciden', () => {
    registerMutation('a');
    expect(hasMutation('a')).toBe(true);
    expect(hasMutation('b')).toBe(false);
    expect(hasMutation(null)).toBe(false);
    expect(hasMutation(undefined)).toBe(false);
  });

  it(`guarda solo los últimos ${MAX_MUTATIONS} (sale el más antiguo)`, () => {
    expect(MAX_MUTATIONS).toBe(200);
    for (let i = 0; i <= MAX_MUTATIONS; i++) registerMutation(`m${i}`);
    expect(hasMutation('m0')).toBe(false);
    expect(hasMutation('m1')).toBe(true);
    expect(hasMutation(`m${MAX_MUTATIONS}`)).toBe(true);
  });

  it('registrar dos veces el mismo id no ocupa dos huecos', () => {
    registerMutation('repetido');
    for (let i = 0; i < MAX_MUTATIONS - 1; i++) registerMutation('repetido');
    for (let i = 0; i < MAX_MUTATIONS - 1; i++) registerMutation(`m${i}`);
    expect(hasMutation('repetido')).toBe(true);
  });

  it('clearMutations vacía el registro', () => {
    registerMutation('a');
    clearMutations();
    expect(hasMutation('a')).toBe(false);
  });
});
