import { PATH_METADATA } from '@nestjs/common/constants.js';

import { GROUP_SCOPED } from './group-member.guard.js';

import type { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return typeof value === 'string' ? [value] : [];
}

/** `true` si la ruta lleva el segmento `:groupId`. */
export function hasGroupIdParam(path: string): boolean {
  return path.split('/').includes(':groupId');
}

/**
 * Devuelve `Controlador → ruta` de cada ruta con `:groupId` cuyo controlador no lleva
 * `@GroupScoped()` (RN-02-26). Se usa en un test de arquitectura.
 */
export function findUnscopedGroupRoutes(discovery: DiscoveryService, scanner: MetadataScanner, reflector: Reflector): string[] {
  const offenders: string[] = [];
  for (const { instance, metatype } of discovery.getControllers()) {
    if (!instance || typeof metatype !== 'function') continue;
    if (reflector.get<boolean | undefined>(GROUP_SCOPED, metatype)) continue;

    const bases = asList(reflector.get<unknown>(PATH_METADATA, metatype));
    const prototype = Object.getPrototypeOf(instance) as object;
    for (const name of scanner.getAllMethodNames(prototype)) {
      const handler = (prototype as Record<string, unknown>)[name] as (...args: unknown[]) => unknown;
      const subs = asList(reflector.get<unknown>(PATH_METADATA, handler));
      for (const base of bases.length ? bases : ['']) {
        for (const sub of subs) {
          const path = `/${`${base}/${sub}`.split('/').filter(Boolean).join('/')}`;
          if (hasGroupIdParam(path)) offenders.push(`${metatype.name} → ${path}`);
        }
      }
    }
  }
  return offenders;
}
