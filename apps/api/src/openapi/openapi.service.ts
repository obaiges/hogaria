import { HttpStatus, Injectable, RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';

import { API_PREFIX } from '../app.constants.js';
import { API_CONTRACT, type ApiContractDefinition } from './api-contract.decorator.js';
import { buildOpenApiDocument, type HttpMethod, type OpenApiDocument, type RouteContract } from './openapi-document.js';

const METHODS: Partial<Record<RequestMethod, HttpMethod>> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.DELETE]: 'delete',
  [RequestMethod.OPTIONS]: 'options',
  [RequestMethod.HEAD]: 'head',
};

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [typeof value === 'string' ? value : '/'];
}

function joinPath(...parts: string[]): string {
  const joined = parts
    .flatMap((p) => p.split('/'))
    .filter(Boolean)
    .join('/');
  return `/${joined}`;
}

/** Recorre los controladores y monta el documento con las rutas que llevan `@ApiContract`. */
@Injectable()
export class OpenApiService {
  private cached: OpenApiDocument | undefined;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  routes(): RouteContract[] {
    const routes: RouteContract[] = [];
    for (const wrapper of this.discovery.getControllers()) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;
      const controllerPaths = asList(this.reflector.get<unknown>(PATH_METADATA, metatype));
      const prototype = Object.getPrototypeOf(instance) as object;

      for (const name of this.scanner.getAllMethodNames(prototype)) {
        const handler = (prototype as Record<string, unknown>)[name] as (...args: unknown[]) => unknown;
        const contract = this.reflector.get<ApiContractDefinition | undefined>(API_CONTRACT, handler);
        const requestMethod = this.reflector.get<RequestMethod | undefined>(METHOD_METADATA, handler);
        const method = requestMethod === undefined ? undefined : METHODS[requestMethod];
        if (!contract || !method) continue;

        const status =
          this.reflector.get<number | undefined>(HTTP_CODE_METADATA, handler) ??
          (method === 'post' ? HttpStatus.CREATED : HttpStatus.OK);
        for (const base of controllerPaths) {
          for (const sub of asList(this.reflector.get<unknown>(PATH_METADATA, handler))) {
            routes.push({ method, path: joinPath(API_PREFIX, base, sub), status, contract });
          }
        }
      }
    }
    return routes;
  }

  document(): OpenApiDocument {
    this.cached ??= buildOpenApiDocument(this.routes(), {
      title: 'Hogaria API',
      version: '1',
      description: 'Generado desde los esquemas zod de `@ApiContract` (solo en desarrollo). Auth en `/api/auth/*` (Better Auth), fuera de este documento.',
    });
    return this.cached;
  }
}
