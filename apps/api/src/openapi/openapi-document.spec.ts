import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { buildOpenApiDocument, toOpenApiPath } from './openapi-document.js';

const info = { title: 'Hogaria API', version: '1' };

interface Operation {
  summary?: string;
  tags?: string[];
  parameters?: unknown[];
  requestBody: { content: Record<string, { schema: unknown }> };
  responses: Record<string, { description?: string; content: Record<string, { schema: unknown }> }>;
}

describe('buildOpenApiDocument', () => {
  it('convierte las rutas de Nest a rutas OpenAPI', () => {
    expect(toOpenApiPath('/api/v1/groups/:groupId/tasks/:taskId')).toBe('/api/v1/groups/{groupId}/tasks/{taskId}');
  });

  it('genera parámetros, cuerpo, respuesta y error a partir de los esquemas zod', () => {
    const doc = buildOpenApiDocument(
      [
        {
          method: 'post',
          path: '/api/v1/groups/:groupId/shopping-lists',
          status: 201,
          contract: {
            summary: 'Crear lista',
            params: z.object({ groupId: z.uuid() }),
            query: z.object({ dryRun: z.boolean().optional(), limit: z.number().int() }),
            body: z.object({ name: z.string().min(1), emoji: z.string().optional() }),
            response: z.object({ id: z.uuid(), name: z.string() }),
          },
        },
        { method: 'delete', path: '/api/v1/groups/:groupId', status: 204, contract: { tags: ['grupos'], response: null } },
      ],
      info,
    );

    expect(doc).toMatchObject({ openapi: '3.1.0', info });
    const op = doc.paths['/api/v1/groups/{groupId}/shopping-lists']?.post as Operation;
    expect(op.summary).toBe('Crear lista');
    expect(op.tags).toEqual(['groups']);
    expect(op.parameters).toEqual([
      { name: 'groupId', in: 'path', required: true, schema: expect.objectContaining({ type: 'string', format: 'uuid' }) },
      { name: 'dryRun', in: 'query', required: false, schema: { type: 'boolean' } },
      { name: 'limit', in: 'query', required: true, schema: expect.objectContaining({ type: 'integer' }) },
    ]);
    expect(op.requestBody.content['application/json']?.schema).toMatchObject({ type: 'object', required: ['name'] });
    expect(op.responses['201']?.content['application/json']?.schema).toMatchObject({ required: ['id', 'name'] });
    expect(op.responses.default?.content['application/problem+json']?.schema).toEqual({ $ref: '#/components/schemas/ProblemDetails' });
    expect(JSON.stringify(doc)).not.toContain('$schema');

    const del = doc.paths['/api/v1/groups/{groupId}']?.delete as Operation;
    expect(del.tags).toEqual(['grupos']);
    expect(del.responses['204']).toEqual({ description: 'Sin contenido' });
    expect(doc.components.schemas.ProblemDetails).toMatchObject({ type: 'object', required: expect.arrayContaining(['type', 'title', 'status', 'code']) });
  });
});
