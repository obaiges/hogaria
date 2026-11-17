import { describe, expect, it } from 'vitest';

import { checkPasswordPolicy, getCommonPasswords, PASSWORD_POLICY_MESSAGES as M } from './common-passwords.js';

// Casos de la spec 01 §11.
describe('checkPasswordPolicy (RN-01-10)', () => {
  const ctx = { email: 'ana.garcia@demo.local', username: 'AnaG' };

  it('longitud: 9 → corta; 10 y 128 → válidas; 129 → larga', () => {
    expect(checkPasswordPolicy('x7#kP2qL9', ctx)).toBe(M.tooShort);
    expect(checkPasswordPolicy('x7#kP2qL9z', ctx)).toBeNull();
    expect(checkPasswordPolicy('x7#kP2qL9z'.padEnd(128, 'w'), ctx)).toBeNull();
    expect(checkPasswordPolicy('x7#kP2qL9z'.padEnd(129, 'w'), ctx)).toBe(M.tooLong);
  });

  it('contraseña común, sin distinguir mayúsculas', () => {
    expect(getCommonPasswords().size).toBeGreaterThanOrEqual(10_000);
    expect(getCommonPasswords().has('1234567890')).toBe(true);
    expect(checkPasswordPolicy('1234567890', ctx)).toBe(M.common);
    expect(checkPasswordPolicy('QwertyUiop', ctx)).toBe(M.common);
  });

  it('no puede contener el email completo ni su parte local (≥ 4 caracteres)', () => {
    expect(checkPasswordPolicy('x-Ana.Garcia@Demo.Local', ctx)).toBe(M.identity);
    expect(checkPasswordPolicy('mi-ana.garcia-2026', ctx)).toBe(M.identity);
  });

  it('una parte local de menos de 4 caracteres no cuenta', () => {
    expect(checkPasswordPolicy('ana-es-muy-segura-9', { email: 'ana@demo.local' })).toBeNull();
  });

  it('no puede contener el username, aunque sea en mayúsculas', () => {
    expect(checkPasswordPolicy('superANAG-2026!', ctx)).toBe(M.identity);
    expect(checkPasswordPolicy('superanag-2026!', { username: 'ANAG' })).toBe(M.identity);
  });

  it('sin contexto solo aplica longitud y lista común', () => {
    expect(checkPasswordPolicy('x7#kP2qL9z')).toBeNull();
    expect(checkPasswordPolicy('x7#kP2qL9z', { email: null, username: null })).toBeNull();
  });
});
