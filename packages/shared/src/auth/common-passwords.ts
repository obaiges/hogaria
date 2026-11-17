/**
 * Política de contraseñas (spec 01, RN-01-10). Se exporta por la subruta
 * `@hogaria/shared/common-passwords` para que la lista (~80 KB) no entre en el bundle
 * principal de la web: las pantallas de contraseña la cargan con `import()` dinámico.
 * El servidor la aplica siempre (hooks `before` de Better Auth).
 */
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../schemas/auth.js';
import { COMMON_PASSWORDS_TEXT } from './common-passwords-list.js';

export const PASSWORD_POLICY_MESSAGES = {
  tooShort: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
  tooLong: `La contraseña es demasiado larga (máximo ${PASSWORD_MAX_LENGTH})`,
  common: 'Esa contraseña es demasiado común. Elige otra',
  identity: 'La contraseña no puede contener tu email ni tu nombre de usuario',
} as const;

let commonPasswords: ReadonlySet<string> | undefined;

/** Las 10 000 contraseñas más comunes, en minúsculas (SecLists, MIT). */
export function getCommonPasswords(): ReadonlySet<string> {
  commonPasswords ??= new Set(COMMON_PASSWORDS_TEXT.split('\n'));
  return commonPasswords;
}

export interface PasswordPolicyContext {
  email?: string | null;
  username?: string | null;
}

/** Parte local del email: `ana.garcia@demo.local` → `ana.garcia`. */
function localPart(email: string): string {
  const at = email.lastIndexOf('@');
  return at > 0 ? email.slice(0, at) : email;
}

/**
 * `null` si la contraseña cumple la política o el mensaje en español del primer fallo:
 * longitud 10–128; no está en la lista de contraseñas comunes (en minúsculas); no
 * contiene el email completo, la parte local del email (si tiene ≥ 4 caracteres) ni
 * el username (sin distinguir mayúsculas).
 */
export function checkPasswordPolicy(password: string, context: PasswordPolicyContext = {}): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_POLICY_MESSAGES.tooShort;
  if (password.length > PASSWORD_MAX_LENGTH) return PASSWORD_POLICY_MESSAGES.tooLong;

  const lower = password.toLowerCase();
  if (getCommonPasswords().has(lower)) return PASSWORD_POLICY_MESSAGES.common;

  const forbidden: string[] = [];
  const email = context.email?.trim().toLowerCase();
  if (email) {
    forbidden.push(email);
    const local = localPart(email);
    if (local.length >= 4) forbidden.push(local);
  }
  const username = context.username?.trim().toLowerCase();
  if (username) forbidden.push(username);
  if (forbidden.some((part) => lower.includes(part))) return PASSWORD_POLICY_MESSAGES.identity;

  return null;
}
