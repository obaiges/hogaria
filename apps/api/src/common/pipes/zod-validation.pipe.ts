import { type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import { ZodError, type ZodType } from 'zod';

import { AppError } from '../errors/app-error.js';

function formatZodErrors(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join('.') : '',
    message: issue.message,
  }));
}

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodType) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    if (!this.schema) return value;
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppError('VALIDATION_ERROR', undefined, formatZodErrors(result.error));
    }
    return result.data;
  }
}

/** Ayuda para usar @Body(new ZodBodyPipe(schema)) con tipado explícito. */
export class ZodBodyPipe<T extends ZodType> extends ZodValidationPipe {
  constructor(schema: T) {
    super(schema);
  }
}
