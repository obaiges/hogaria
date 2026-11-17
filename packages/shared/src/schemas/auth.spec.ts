import { describe, expect, it } from 'vitest';

import {
  emailSchema,
  isEmailIdentifier,
  isValidUsername,
  nameSchema,
  passwordSchema,
  signInInput,
  signUpInput,
  usernameSchema,
} from './auth.js';

describe('usernameSchema (RN-01-09)', () => {
  it.each(['ana', 'ana_garcia', 'ana.garcia', 'a_b', 'Ana', 'oscar.b_2', '___', 'a'.repeat(30)])('acepta "%s"', (value) => {
    expect(usernameSchema.safeParse(value).success).toBe(true);
    expect(isValidUsername(value)).toBe(true);
  });

  it.each([
    ['ab', 'corto'],
    ['a'.repeat(31), 'largo'],
    ['.ana', 'empieza por punto'],
    ['ana.', 'acaba en punto'],
    ['ana garcía', 'espacio y tilde'],
    ['ana-garcia', 'guion'],
    ['ana@x', 'arroba'],
    ['ñandú', 'eñe'],
    ['', 'vacío'],
  ])('rechaza "%s" (%s)', (value) => {
    expect(usernameSchema.safeParse(value).success).toBe(false);
    expect(isValidUsername(value)).toBe(false);
  });
});

describe('nameSchema, emailSchema y passwordSchema', () => {
  it('nombre: trim y 1–50 caracteres', () => {
    expect(nameSchema.parse('  Ana  ')).toBe('Ana');
    expect(nameSchema.safeParse('   ').success).toBe(false);
    expect(nameSchema.safeParse('a'.repeat(51)).success).toBe(false);
  });

  it('email: en minúsculas y con formato válido', () => {
    expect(emailSchema.parse('  Ana@Demo.Local ')).toBe('ana@demo.local');
    expect(emailSchema.safeParse('no-es-un-email').success).toBe(false);
  });

  it('contraseña: 10–128 caracteres con los mensajes de la spec', () => {
    expect(passwordSchema.safeParse('a'.repeat(10)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(9)).error?.issues[0]?.message).toBe('La contraseña debe tener al menos 10 caracteres');
    expect(passwordSchema.safeParse('a'.repeat(129)).error?.issues[0]?.message).toBe('La contraseña es demasiado larga (máximo 128)');
  });
});

describe('signUpInput y signInInput', () => {
  it('registro normaliza los campos', () => {
    expect(signUpInput.parse({ name: ' Ana ', email: 'ANA@demo.local', username: 'Ana_G', password: 'contraseña-larga' })).toEqual({
      name: 'Ana',
      email: 'ana@demo.local',
      username: 'Ana_G',
      password: 'contraseña-larga',
    });
  });

  it('login con un único identificador', () => {
    expect(signInInput.parse({ identifier: ' ana ', password: 'x' })).toEqual({ identifier: 'ana', password: 'x' });
    expect(signInInput.safeParse({ identifier: '', password: 'x' }).success).toBe(false);
    expect(isEmailIdentifier('ana@demo.local')).toBe(true);
    expect(isEmailIdentifier('ana')).toBe(false);
  });
});
