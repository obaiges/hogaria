import { z } from 'zod';

import { problemDetailsSchema } from '@hogaria/shared';

import type { ApiContractDefinition } from './api-contract.decorator.js';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head';

export interface RouteContract {
  method: HttpMethod;
  /** Ruta completa al estilo Nest, con prefijo: `/api/v1/groups/:groupId`. */
  path: string;
  /** Código de éxito (por defecto 201 en POST y 200 en el resto, como Nest). */
  status: number;
  contract: ApiContractDefinition;
}

type JsonSchema = Record<string, unknown>;

export interface OpenApiDocument {
  openapi: '3.1.0';
  info: { title: string; version: string; description?: string };
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, JsonSchema> };
}

function toJsonSchema(schema: z.ZodType, io: 'input' | 'output'): JsonSchema {
  // OpenAPI 3.1 usa JSON Schema 2020-12, el formato por defecto de zod 4.
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema, { io, unrepresentable: 'any' }) as JsonSchema;
  return json;
}

/** `/api/v1/groups/:groupId` → `/api/v1/groups/{groupId}` */
export function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function parameters(schema: z.ZodObject | undefined, location: 'query' | 'path') {
  if (!schema) return [];
  return Object.entries(schema.shape).map(([name, field]) => ({
    name,
    in: location,
    required: location === 'path' ? true : !(field as z.ZodType).safeParse(undefined).success,
    schema: toJsonSchema(field as z.ZodType, 'input'),
  }));
}

function defaultTag(path: string): string {
  const segments = path.split('/').filter((s) => s && s !== 'api' && !/^v\d+$/.test(s) && !s.startsWith(':'));
  return segments[0] ?? 'api';
}

const PROBLEM_REF = { $ref: '#/components/schemas/ProblemDetails' };

/** Documento OpenAPI 3.1 a partir de las rutas con `@ApiContract`. */
export function buildOpenApiDocument(routes: RouteContract[], info: OpenApiDocument['info']): OpenApiDocument {
  const paths: OpenApiDocument['paths'] = {};
  const sorted = [...routes].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  for (const route of sorted) {
    const { contract } = route;
    const success =
      contract.response === null
        ? { description: 'Sin contenido' }
        : { description: 'OK', content: { 'application/json': { schema: toJsonSchema(contract.response, 'output') } } };

    const operation: Record<string, unknown> = {
      tags: contract.tags ?? [defaultTag(route.path)],
      ...(contract.summary ? { summary: contract.summary } : {}),
      ...(contract.description ? { description: contract.description } : {}),
      parameters: [...parameters(contract.params, 'path'), ...parameters(contract.query, 'query')],
      ...(contract.body
        ? { requestBody: { required: true, content: { 'application/json': { schema: toJsonSchema(contract.body, 'input') } } } }
        : {}),
      responses: {
        [String(route.status)]: success,
        default: { description: 'Error (RFC 9457)', content: { 'application/problem+json': { schema: PROBLEM_REF } } },
      },
    };

    const key = toOpenApiPath(route.path);
    paths[key] = { ...paths[key], [route.method]: operation };
  }

  return {
    openapi: '3.1.0',
    info,
    paths,
    components: { schemas: { ProblemDetails: toJsonSchema(problemDetailsSchema, 'output') } },
  };
}
