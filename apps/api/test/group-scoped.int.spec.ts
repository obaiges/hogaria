import { Controller, Get, Module } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GroupMemberGuard, GroupScoped } from '../src/common/guards/group-member.guard.js';
import { findUnscopedGroupRoutes, hasGroupIdParam } from '../src/common/guards/group-scoped.check.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';

import type { INestApplicationContext } from '@nestjs/common';

@Module({ imports: [DiscoveryModule] })
class DiscoveryHostModule {}

function unscoped(app: INestApplicationContext): string[] {
  return findUnscopedGroupRoutes(app.get(DiscoveryService), app.get(MetadataScanner), app.get(Reflector));
}

/**
 * Test de arquitectura (HOG-101, RN-02-26): todo controlador con `:groupId` en la ruta
 * lleva `@GroupScoped()`. Si falla, añade el decorador a la clase del controlador.
 */
describe('@GroupScoped() obligatorio en las rutas con :groupId', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ imports: [DiscoveryHostModule] });
  });

  afterAll(async () => {
    await t.close();
  });

  it('ningún controlador de la API tiene rutas de grupo sin @GroupScoped()', () => {
    expect(unscoped(t.app)).toEqual([]);
  });

  it('hasGroupIdParam detecta el segmento exacto', () => {
    expect(hasGroupIdParam('groups/:groupId')).toBe(true);
    expect(hasGroupIdParam('/groups/:groupId/members')).toBe(true);
    expect(hasGroupIdParam('groups/:groupIdx')).toBe(false);
    expect(hasGroupIdParam('me/groups')).toBe(false);
  });

  it('detecta un controlador sin el decorador (en la clase o en el método)', async () => {
    @Controller('groups/:groupId/olvidado')
    class ForgottenController {
      @Get()
      list() {
        return [];
      }
    }

    @Controller('groups')
    class MethodLevelController {
      @Get(':groupId')
      one() {
        return {};
      }

      @Get()
      all() {
        return [];
      }
    }

    @GroupScoped()
    @Controller('groups/:groupId/bien')
    class ScopedController {
      @Get()
      list() {
        return [];
      }
    }

    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule],
      controllers: [ForgottenController, MethodLevelController, ScopedController],
    })
      .overrideGuard(GroupMemberGuard)
      .useValue({ canActivate: () => true })
      .compile();

    expect(unscoped(moduleRef)).toEqual([
      'ForgottenController → /groups/:groupId/olvidado',
      'MethodLevelController → /groups/:groupId',
    ]);
    await moduleRef.close();
  });
});
