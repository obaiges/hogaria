import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseClientMutationId } from '../context/request-context.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { AppError } from './app-error.js';

describe('AppError', () => {
  it('mapea code a status y type', () => {
    const e = new AppError('NOT_FOUND', 'No existe');
    expect(e.status).toBe(404);
    expect(e.type).toContain('not-found');
  });
});

describe('ZodValidationPipe', () => {
  it('lanza VALIDATION_ERROR 422 con errores', () => {
    const pipe = new ZodValidationPipe(z.object({ a: z.string() }));
    try {
      pipe.transform({ a: 1 }, { type: 'body', metatype: Object, data: '' });
      throw new Error('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('VALIDATION_ERROR');
      expect((e as AppError).status).toBe(422);
      expect((e as AppError).errors?.length).toBeGreaterThan(0);
    }
  });
});

describe('request-context', () => {
  it('acepta uuid válido y rechaza inválidos/ausentes', () => {
    expect(parseClientMutationId('123e4567-e89b-42d3-a456-426614174000')).toBeTruthy();
    expect(parseClientMutationId('not-a-uuid')).toBeNull();
    expect(parseClientMutationId(undefined)).toBeNull();
  });
});
