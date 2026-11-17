import { describe, expect, it } from 'vitest';

import { router } from './router';

import type { RouteObject } from 'react-router';

const expectedRoutes = [
  '/entrar',
  '/registro',
  '/recuperar',
  '/invite/:token',
  '/grupos',
  '/g/:groupId',
  '/g/:groupId/compra',
  '/g/:groupId/compra/indispensables',
  '/g/:groupId/compra/historial',
  '/g/:groupId/compra/:listId',
  '/g/:groupId/comidas',
  '/g/:groupId/recetas',
  '/g/:groupId/recetas/nueva',
  '/g/:groupId/recetas/:id',
  '/g/:groupId/recetas/:id/editar',
  '/g/:groupId/nevera',
  '/g/:groupId/tareas',
  '/g/:groupId/calendario',
  '/g/:groupId/horarios',
  '/g/:groupId/gastos',
  '/g/:groupId/facturas',
  '/g/:groupId/asistente',
  '/g/:groupId/actividad',
  '/g/:groupId/ajustes',
  '/perfil',
  '/admin',
  '/legal/privacidad',
  '/legal/terminos',
];

describe('router (HOG-005)', () => {
  it('incluye todas las rutas fijadas', () => {
    // Las rutas están anidadas (layout público/privado, HOG-053): se aplanan.
    const flatten = (rs: RouteObject[]): (string | undefined)[] => rs.flatMap((r) => [r.path, ...flatten(r.children ?? [])]);
    const paths = flatten(router.routes as RouteObject[]);
    for (const path of expectedRoutes) {
      expect(paths).toContain(path);
    }
  });
});
