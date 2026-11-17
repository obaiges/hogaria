import { describe, expect, it } from "vitest";

import { parseRetryAfter, rateLimitedMessage, signInErrorMessage, SIGN_IN_MESSAGES } from "./auth-errors";

describe("signInErrorMessage (spec 01 §7)", () => {
  it("credenciales incorrectas: mensaje genérico también para username y cuenta sin contraseña", () => {
    for (const code of ["INVALID_EMAIL_OR_PASSWORD", "INVALID_USERNAME_OR_PASSWORD", "CREDENTIAL_ACCOUNT_NOT_FOUND"]) {
      expect(signInErrorMessage(code)).toBe("Email, usuario o contraseña incorrectos");
    }
  });

  it("cuenta bloqueada y email sin verificar", () => {
    expect(signInErrorMessage("ACCOUNT_BLOCKED")).toBe("Tu cuenta está bloqueada. Habla con el administrador.");
    expect(signInErrorMessage("EMAIL_NOT_VERIFIED")).toBe(SIGN_IN_MESSAGES.emailNotVerified);
  });

  it("demasiados intentos: minutos redondeados hacia arriba desde Retry-After", () => {
    expect(signInErrorMessage("RATE_LIMITED", 55)).toBe("Demasiados intentos. Vuelve a intentarlo en 1 min.");
    expect(signInErrorMessage("RATE_LIMITED", 61)).toBe("Demasiados intentos. Vuelve a intentarlo en 2 min.");
    expect(signInErrorMessage("RATE_LIMITED", 1200)).toBe("Demasiados intentos. Vuelve a intentarlo en 20 min.");
    expect(rateLimitedMessage(null)).toBe("Demasiados intentos. Vuelve a intentarlo en 1 min.");
  });

  it("código desconocido → mensaje genérico", () => {
    expect(signInErrorMessage("ALGO_RARO")).toBe(SIGN_IN_MESSAGES.generic);
    expect(signInErrorMessage(undefined)).toBe(SIGN_IN_MESSAGES.generic);
  });

  it("parseRetryAfter", () => {
    expect(parseRetryAfter("30")).toBe(30);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("mañana")).toBeNull();
  });
});
