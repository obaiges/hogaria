/**
 * Códigos de error de la API (docs/04-api-y-tiempo-real.md §Códigos de error).
 * Las respuestas de error usan RFC 9457 `application/problem+json`.
 */
import { z } from 'zod';

export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN_NOT_OWNER',
  'ACCOUNT_BLOCKED',
  'FORBIDDEN_ORIGIN',
  'NOT_FOUND',
  'CONFLICT',
  'STALE_VERSION',
  'VALIDATION_ERROR',
  'INVITE_INVALID',
  'INVITE_REQUIRED',
  'AI_LIMIT_REACHED',
  'AI_UNAVAILABLE',
  'AI_NOTICE_REQUIRED',
  'RATE_LIMITED',
  'IMAGE_INVALID',
  'HEALTH_CONSENT_REQUIRED',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN_NOT_OWNER: 403,
  ACCOUNT_BLOCKED: 403,
  FORBIDDEN_ORIGIN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  STALE_VERSION: 409,
  VALIDATION_ERROR: 422,
  INVITE_INVALID: 410,
  INVITE_REQUIRED: 403,
  AI_LIMIT_REACHED: 429,
  AI_UNAVAILABLE: 503,
  AI_NOTICE_REQUIRED: 403,
  RATE_LIMITED: 429,
  IMAGE_INVALID: 422,
  HEALTH_CONSENT_REQUIRED: 422,
  INTERNAL: 500,
};

/** Título corto del problem+json (campo `title`). */
export const ERROR_TITLES_ES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'Sesión no válida',
  FORBIDDEN_NOT_OWNER: 'No eres el dueño',
  ACCOUNT_BLOCKED: 'Cuenta bloqueada',
  FORBIDDEN_ORIGIN: 'Origen no permitido',
  NOT_FOUND: 'No encontrado',
  CONFLICT: 'Conflicto',
  STALE_VERSION: 'Cambio simultáneo',
  VALIDATION_ERROR: 'Datos no válidos',
  INVITE_INVALID: 'Invitación no válida',
  INVITE_REQUIRED: 'Invitación necesaria',
  AI_LIMIT_REACHED: 'Límite de IA alcanzado',
  AI_UNAVAILABLE: 'IA no disponible',
  AI_NOTICE_REQUIRED: 'Aviso de IA pendiente',
  RATE_LIMITED: 'Demasiadas peticiones',
  IMAGE_INVALID: 'Imagen no válida',
  HEALTH_CONSENT_REQUIRED: 'Consentimiento necesario',
  INTERNAL: 'Error interno',
};

/** Mensaje que ve el usuario en la interfaz. */
export const ERROR_MESSAGES_ES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'Tu sesión ha caducado. Vuelve a entrar',
  FORBIDDEN_NOT_OWNER: 'Solo quien lo creó puede cambiarlo',
  ACCOUNT_BLOCKED: 'Tu cuenta está bloqueada. Habla con quien administra Hogaria',
  FORBIDDEN_ORIGIN: 'Origen no permitido',
  NOT_FOUND: 'No encontrado',
  CONFLICT: 'Ya existe algo igual. Revisa los datos',
  STALE_VERSION: 'Otra persona acaba de cambiar esto. Revisa la versión actual',
  VALIDATION_ERROR: 'Revisa los datos del formulario',
  INVITE_INVALID: 'Invitación no válida o caducada',
  INVITE_REQUIRED: 'Necesitas una invitación para registrarte',
  AI_LIMIT_REACHED: 'Habéis llegado al límite de IA de hoy. Se renueva a las 00:00',
  AI_UNAVAILABLE: 'La IA está saturada, prueba en unos minutos',
  AI_NOTICE_REQUIRED: 'Antes de usar la IA tienes que aceptar el aviso de privacidad',
  RATE_LIMITED: 'Demasiados intentos. Espera un momento y vuelve a probar',
  IMAGE_INVALID: 'La imagen no es válida. Usa JPG, PNG o WebP de hasta 5 MB',
  HEALTH_CONSENT_REQUIRED: 'Para guardar alergias o restricciones necesitamos tu consentimiento',
  INTERNAL: 'Algo ha fallado. Inténtalo de nuevo',
};

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

/** Mensaje en español para cualquier código (desconocido → mensaje genérico). */
export function errorMessageEs(code: string | null | undefined): string {
  return isErrorCode(code) ? ERROR_MESSAGES_ES[code] : ERROR_MESSAGES_ES.INTERNAL;
}

export const problemFieldErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
});

/**
 * Problem Details (RFC 9457) de Hogaria. Es `looseObject` porque algunos códigos añaden
 * miembros de extensión (`current`, `feature`, `limit`, `resetsAt`). `code` es `string`
 * porque `/api/auth/*` devuelve también códigos propios de Better Auth.
 */
export const problemDetailsSchema = z.looseObject({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional(),
  errors: z.array(problemFieldErrorSchema).optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
export type ProblemFieldError = z.infer<typeof problemFieldErrorSchema>;

export const PROBLEM_TYPE_BASE = 'https://hogaria.obaiges.com/errors/';

/** `VALIDATION_ERROR` → `https://hogaria.obaiges.com/errors/validation-error` */
export function problemTypeFor(code: ErrorCode): string {
  return PROBLEM_TYPE_BASE + code.toLowerCase().replace(/_/g, '-');
}
