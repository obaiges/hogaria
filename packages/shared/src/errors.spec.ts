import { describe, expect, it } from 'vitest';

import {
  ERROR_CODES,
  ERROR_MESSAGES_ES,
  ERROR_STATUS,
  ERROR_TITLES_ES,
  errorMessageEs,
  isErrorCode,
  problemDetailsSchema,
  problemTypeFor,
} from './errors';

describe('errores', () => {
  it('todo código tiene status, título y mensaje en español', () => {
    for (const code of ERROR_CODES) {
      expect(ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
      expect(ERROR_TITLES_ES[code].length).toBeGreaterThan(0);
      expect(ERROR_MESSAGES_ES[code].length).toBeGreaterThan(0);
    }
  });

  it('coincide con la tabla de docs/04', () => {
    expect([...ERROR_CODES]).toEqual([
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
    ]);
    expect(ERROR_STATUS.NOT_FOUND).toBe(404);
    expect(ERROR_STATUS.INVITE_INVALID).toBe(410);
    expect(ERROR_STATUS.AI_UNAVAILABLE).toBe(503);
  });

  it('isErrorCode y errorMessageEs', () => {
    expect(isErrorCode('NOT_FOUND')).toBe(true);
    expect(isErrorCode('INVALID_EMAIL_OR_PASSWORD')).toBe(false);
    expect(isErrorCode(42)).toBe(false);
    expect(errorMessageEs('NOT_FOUND')).toBe('No encontrado');
    expect(errorMessageEs('ALGO_RARO')).toBe(ERROR_MESSAGES_ES.INTERNAL);
    expect(errorMessageEs(undefined)).toBe(ERROR_MESSAGES_ES.INTERNAL);
  });

  it('problemTypeFor', () => {
    expect(problemTypeFor('VALIDATION_ERROR')).toBe(
      'https://hogaria.obaiges.com/errors/validation-error',
    );
  });

  it('problemDetailsSchema acepta extensiones y rechaza lo incompleto', () => {
    const ok = problemDetailsSchema.parse({
      type: problemTypeFor('STALE_VERSION'),
      title: 'Cambio simultáneo',
      status: 409,
      code: 'STALE_VERSION',
      current: { id: 'x' },
    });
    expect(ok.current).toEqual({ id: 'x' });
    expect(
      problemDetailsSchema.safeParse({
        type: 't',
        title: 'Datos no válidos',
        status: 422,
        code: 'VALIDATION_ERROR',
        errors: [{ path: 'quantity', message: 'Debe ser mayor que 0' }],
      }).success,
    ).toBe(true);
    expect(problemDetailsSchema.safeParse({ title: 'x', status: 500 }).success).toBe(false);
  });
});
