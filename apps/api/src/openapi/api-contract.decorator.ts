import { SetMetadata } from '@nestjs/common';

import type { z } from 'zod';

export const API_CONTRACT = Symbol('API_CONTRACT');

/** Esquemas zod de una ruta (normalmente los de `packages/shared/src/schemas`). */
export interface ApiContractDefinition {
  summary?: string;
  description?: string;
  /** Agrupación en Swagger UI; por defecto, el primer segmento de la ruta. */
  tags?: string[];
  body?: z.ZodType;
  query?: z.ZodObject;
  params?: z.ZodObject;
  /** Respuesta de éxito. `null` = sin cuerpo (p. ej. 204). */
  response: z.ZodType | null;
}

/**
 * Registra los esquemas de la ruta para la documentación OpenAPI de `/api/docs`
 * (solo desarrollo, HOG-016). No valida: la validación sigue en `ZodValidationPipe`.
 *
 * ```ts
 * @ApiContract({ body: createListInput, response: shoppingListDto })
 * @Post()
 * create(@Body(new ZodValidationPipe(createListInput)) body: CreateListInput) { … }
 * ```
 */
export const ApiContract = (contract: ApiContractDefinition) => SetMetadata(API_CONTRACT, contract);
