/**
 * Esquemas de autenticación (spec 01 §3, RN-01-07 a RN-01-10). Los usan el registro y el
 * login de la web y las validaciones del servidor.
 */
import { z } from 'zod';

export const NAME_MAX_LENGTH = 50;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/** RN-01-07: nombre visible, 1–50 caracteres tras `trim`. */
export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Escribe tu nombre')
  .max(NAME_MAX_LENGTH, `El nombre puede tener como mucho ${NAME_MAX_LENGTH} caracteres`);

/** RN-01-08: formato válido; se guarda en minúsculas. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Escribe un email válido'));

/**
 * RN-01-09: 3–30 caracteres, solo letras, números, `_` y `.`, sin empezar ni acabar
 * por `.`. Se acepta en mayúsculas (Better Auth guarda `displayUsername` tal cual y
 * `username` en minúsculas); la unicidad no distingue mayúsculas.
 */
export const USERNAME_PATTERN = /^[a-z0-9_](?:[a-z0-9_.]*[a-z0-9_])?$/i;

export function isValidUsername(value: string): boolean {
  return value.length >= USERNAME_MIN_LENGTH && value.length <= USERNAME_MAX_LENGTH && USERNAME_PATTERN.test(value);
}

export const usernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN_LENGTH, `El nombre de usuario debe tener al menos ${USERNAME_MIN_LENGTH} caracteres`)
  .max(USERNAME_MAX_LENGTH, `El nombre de usuario puede tener como mucho ${USERNAME_MAX_LENGTH} caracteres`)
  .regex(USERNAME_PATTERN, 'Solo minúsculas, números, punto y guion bajo (sin empezar ni acabar en punto)');

/**
 * RN-01-10 (parte de longitud). La lista de contraseñas comunes y la comprobación de
 * email/username (`checkPasswordPolicy`) llegan con HOG-058.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(PASSWORD_MAX_LENGTH, `La contraseña es demasiado larga (máximo ${PASSWORD_MAX_LENGTH})`);

/** Registro con contraseña (`POST /api/auth/sign-up/email`). */
export const signUpInput = z.object({
  name: nameSchema,
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
});
export type SignUpInput = z.infer<typeof signUpInput>;

/**
 * Login: un único campo "Email o nombre de usuario". El cliente llama a
 * `/sign-in/email` si `identifier` contiene `@` y a `/sign-in/username` si no.
 */
export const signInInput = z.object({
  identifier: z.string().trim().min(1, 'Escribe tu email o tu nombre de usuario'),
  password: z.string().min(1, 'Escribe tu contraseña'),
});
export type SignInInput = z.infer<typeof signInInput>;

export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes('@');
}
