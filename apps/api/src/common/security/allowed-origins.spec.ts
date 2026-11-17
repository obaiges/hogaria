import { describe, expect, it } from 'vitest';

import { getAllowedOrigins, isForbiddenOrigin } from './allowed-origins.js';

describe('getAllowedOrigins', () => {
  it('solo APP_URL (normalizado a origen) fuera de desarrollo', () => {
    expect(getAllowedOrigins({ NODE_ENV: 'production', APP_URL: 'https://hogaria.obaiges.com/' })).toEqual(['https://hogaria.obaiges.com']);
  });

  it('añade localhost:5173 en desarrollo, sin duplicar', () => {
    expect(getAllowedOrigins({ NODE_ENV: 'development', APP_URL: 'https://hogaria.obaiges.com' })).toEqual([
      'https://hogaria.obaiges.com',
      'http://localhost:5173',
    ]);
    expect(getAllowedOrigins({ NODE_ENV: 'development', APP_URL: 'http://localhost:5173' })).toEqual(['http://localhost:5173']);
  });

  it('ignora una APP_URL ausente o no válida', () => {
    expect(getAllowedOrigins({ NODE_ENV: 'test' })).toEqual([]);
    expect(getAllowedOrigins({ NODE_ENV: 'test', APP_URL: 'no-es-url' })).toEqual([]);
  });
});

describe('isForbiddenOrigin', () => {
  const allowed = ['https://hogaria.obaiges.com'];

  it('bloquea mutaciones desde un origen no permitido', () => {
    for (const m of ['POST', 'patch', 'PUT', 'DELETE']) expect(isForbiddenOrigin(m, 'https://evil.example', allowed)).toBe(true);
  });

  it('deja pasar lecturas, orígenes permitidos y peticiones sin Origin', () => {
    expect(isForbiddenOrigin('GET', 'https://evil.example', allowed)).toBe(false);
    expect(isForbiddenOrigin('OPTIONS', 'https://evil.example', allowed)).toBe(false);
    expect(isForbiddenOrigin('POST', 'https://hogaria.obaiges.com', allowed)).toBe(false);
    expect(isForbiddenOrigin('POST', undefined, allowed)).toBe(false);
    expect(isForbiddenOrigin('POST', '', allowed)).toBe(false);
  });
});
