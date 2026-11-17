/**
 * Mensajes de error de `/entrar` (spec 01 §7). Better Auth responde `{ code, message }`
 * y, en los límites (RN-01-26/27), la cabecera `Retry-After` en segundos. Lo usará
 * `SignInPage` (HOG-053).
 */
export const SIGN_IN_MESSAGES = {
  invalidCredentials: "Email, usuario o contraseña incorrectos",
  emailNotVerified: "Tu email aún no está verificado. Te hemos reenviado el enlace.",
  accountBlocked: "Tu cuenta está bloqueada. Habla con el administrador.",
  generic: "No se ha podido entrar. Inténtalo de nuevo.",
} as const;

/** "Demasiados intentos. Vuelve a intentarlo en {n} min." con `n` = ⌈Retry-After / 60⌉. */
export function rateLimitedMessage(retryAfterSeconds: number | null | undefined): string {
  const minutes = Math.max(1, Math.ceil((retryAfterSeconds ?? 60) / 60));
  return `Demasiados intentos. Vuelve a intentarlo en ${minutes} min.`;
}

/** `Retry-After` en segundos (Better Auth lo manda como número de segundos). */
export function parseRetryAfter(value: string | null | undefined): number | null {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

export function signInErrorMessage(code: string | null | undefined, retryAfterSeconds?: number | null): string {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_USERNAME_OR_PASSWORD":
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
      return SIGN_IN_MESSAGES.invalidCredentials;
    case "EMAIL_NOT_VERIFIED":
      return SIGN_IN_MESSAGES.emailNotVerified;
    case "ACCOUNT_BLOCKED":
      return SIGN_IN_MESSAGES.accountBlocked;
    case "RATE_LIMITED":
      return rateLimitedMessage(retryAfterSeconds);
    default:
      return SIGN_IN_MESSAGES.generic;
  }
}
