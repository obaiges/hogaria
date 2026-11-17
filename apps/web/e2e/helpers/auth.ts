import type { TestUser } from './api';
import type { Page } from '@playwright/test';

/**
 * Inicia sesión como `user` en `page` (vía UI o con la cookie de la API). Llega con
 * Better Auth (HOG-050/HOG-053); hasta entonces lanza para que nadie lo use por error.
 */
export function loginAs(_page: Page, _user: TestUser): Promise<void> {
  return Promise.reject(new Error('Not implemented: loginAs llega con Better Auth (HOG-050)'));
}
