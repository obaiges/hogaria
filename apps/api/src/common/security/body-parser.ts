import { json, type NextFunction, type Request, type RequestHandler, type Response } from 'express';

import { ERROR_MESSAGES_ES, ERROR_TITLES_ES, problemTypeFor } from '@hogaria/shared';

export const JSON_BODY_LIMIT = '1mb';

/**
 * JSON de hasta 1 MB, solo bajo `/api/v1`: Better Auth (`/api/auth/*`, HOG-050) lee
 * el cuerpo sin procesar y no debe pasar por este parser.
 */
export const jsonBodyParser: RequestHandler = json({ limit: JSON_BODY_LIMIT });

/**
 * Los errores del parser ocurren antes de Nest, así que aquí se traducen a
 * problem+json: `422 VALIDATION_ERROR` tanto para JSON mal formado como para un
 * cuerpo de más de 1 MB (el `code` siempre va con su `status` de docs/04).
 */
export function bodyParserErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  const type = (err as { type?: unknown } | null)?.type;
  if (type !== 'entity.too.large' && type !== 'entity.parse.failed') {
    next(err);
    return;
  }
  res
    .status(422)
    .type('application/problem+json')
    .send(
      JSON.stringify({
        type: problemTypeFor('VALIDATION_ERROR'),
        title: ERROR_TITLES_ES.VALIDATION_ERROR,
        status: 422,
        code: 'VALIDATION_ERROR',
        detail: type === 'entity.too.large' ? `El cuerpo de la petición supera ${JSON_BODY_LIMIT.toUpperCase()}` : ERROR_MESSAGES_ES.VALIDATION_ERROR,
      }),
    );
}
