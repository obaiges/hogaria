import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRequestLimiter } from './auth-request-limiter.js';
import { LoginRateLimiter } from './login-rate-limiter.js';

const IP = '203.0.113.7';

describe('LoginRateLimiter (RN-01-26)', () => {
  let limiter: LoginRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T10:00:00Z'));
    limiter = new LoginRateLimiter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('5 fallos por minuto por IP + identificador: el 6.º intento se rechaza con Retry-After', () => {
    for (let i = 0; i < 5; i++) {
      expect(limiter.check(IP, 'Ana@Demo.local')).toBeNull();
      limiter.recordFailure(IP, 'ana@demo.local');
      vi.advanceTimersByTime(1_000);
    }
    // El primer fallo fue hace 5 s: hueco dentro de 55 s.
    expect(limiter.check(IP, ' ANA@demo.local ')).toBe(55);
    // Otra IP con el mismo identificador sigue pudiendo (aún no hay 20 por hora).
    expect(limiter.check('198.51.100.1', 'ana@demo.local')).toBeNull();
    vi.advanceTimersByTime(55_000);
    expect(limiter.check(IP, 'ana@demo.local')).toBeNull();
  });

  it('un login correcto reinicia el contador de IP + identificador', () => {
    for (let i = 0; i < 5; i++) limiter.recordFailure(IP, 'ana');
    expect(limiter.check(IP, 'ana')).not.toBeNull();
    limiter.recordSuccess(IP, 'ana');
    expect(limiter.check(IP, 'ana')).toBeNull();
  });

  it('20 fallos por hora por identificador, aunque cambie la IP', () => {
    for (let i = 0; i < 20; i++) {
      limiter.recordFailure(`10.0.0.${i}`, 'ana');
      vi.advanceTimersByTime(2 * 60_000); // nunca 5 en el mismo minuto
    }
    // El primero fue hace 40 min: hueco dentro de 20 min.
    expect(limiter.check('10.0.1.1', 'ana')).toBe(20 * 60);
    vi.advanceTimersByTime(20 * 60_000);
    expect(limiter.check('10.0.1.1', 'ana')).toBeNull();
  });
});

describe('AuthRequestLimiter (RN-01-27, RN-01-14)', () => {
  let limiter: AuthRequestLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T10:00:00Z'));
    limiter = new AuthRequestLimiter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registro: 5 por hora por IP', () => {
    for (let i = 0; i < 5; i++) expect(limiter.consume('/sign-up/email', IP, `u${i}@x.es`)).toBeNull();
    expect(limiter.consume('/sign-up/email', IP, 'otro@x.es')).toBe(3600);
    expect(limiter.consume('/sign-up/email', '198.51.100.1', 'otro@x.es')).toBeNull();
  });

  it('recuperar contraseña: 3 por hora por email y 10 por hora por IP', () => {
    for (let i = 0; i < 3; i++) expect(limiter.consume('/request-password-reset', IP, 'ana@x.es')).toBeNull();
    expect(limiter.consume('/request-password-reset', IP, 'ANA@x.es')).not.toBeNull();
    for (let i = 0; i < 7; i++) expect(limiter.consume('/request-password-reset', IP, `u${i}@x.es`)).toBeNull();
    expect(limiter.consume('/request-password-reset', IP, 'nuevo@x.es')).not.toBeNull();
  });

  it('reenviar verificación: 1 cada 60 s y 5 por hora por email', () => {
    for (let i = 0; i < 4; i++) {
      expect(limiter.consume('/send-verification-email', IP, 'ana@x.es')).toBeNull();
      expect(limiter.consume('/send-verification-email', IP, 'ana@x.es')).toBe(60);
      vi.advanceTimersByTime(60_000);
    }
    expect(limiter.consume('/send-verification-email', IP, 'ana@x.es')).toBeNull(); // 5.º en la hora
    // Se aplica la espera más larga: la de la hora (el 1.º fue hace 4 min).
    expect(limiter.consume('/send-verification-email', IP, 'ana@x.es')).toBe(3600 - 4 * 60);
    vi.advanceTimersByTime(60_000);
    expect(limiter.consume('/send-verification-email', IP, 'ana@x.es')).toBe(3600 - 5 * 60);
  });

  it('resto de rutas: 60 por minuto por IP; una petición rechazada no cuenta', () => {
    for (let i = 0; i < 60; i++) expect(limiter.consume('/get-session', IP, undefined)).toBeNull();
    expect(limiter.consume('/sign-out', IP, undefined)).toBe(60);
    vi.advanceTimersByTime(60_000);
    expect(limiter.consume('/get-session', IP, undefined)).toBeNull();
  });
});
