import { HOUR_MS, MINUTE_MS, normalizeIdentifier, SlidingWindowCounter, toRetryAfterSeconds } from './sliding-window.js';

/**
 * Límites del resto de `/api/auth/*` (RN-01-27, RN-01-14), contando **todas** las
 * peticiones, en memoria:
 * - `/sign-up/email`: 5 por hora por IP.
 * - `/request-password-reset`: 3 por hora por email y 10 por hora por IP.
 * - `/send-verification-email`: 1 cada 60 s y 5 por hora por email.
 * - Resto (salvo el login, que va con `LoginRateLimiter`): 60 por minuto por IP.
 */
export class AuthRequestLimiter {
  readonly signUpPerIp = new SlidingWindowCounter(5, HOUR_MS);
  readonly resetPerEmail = new SlidingWindowCounter(3, HOUR_MS);
  readonly resetPerIp = new SlidingWindowCounter(10, HOUR_MS);
  readonly verifyPerEmailMinute = new SlidingWindowCounter(1, MINUTE_MS);
  readonly verifyPerEmailHour = new SlidingWindowCounter(5, HOUR_MS);
  readonly otherPerIp = new SlidingWindowCounter(60, MINUTE_MS);

  private rules(path: string, ip: string, email: string): [SlidingWindowCounter, string][] {
    switch (path) {
      case '/sign-up/email':
        return [[this.signUpPerIp, ip]];
      case '/request-password-reset':
        return [
          [this.resetPerIp, ip],
          ...(email ? ([[this.resetPerEmail, email]] as [SlidingWindowCounter, string][]) : []),
        ];
      case '/send-verification-email':
        return email
          ? [
              [this.verifyPerEmailMinute, email],
              [this.verifyPerEmailHour, email],
            ]
          : [[this.otherPerIp, ip]];
      default:
        return [[this.otherPerIp, ip]];
    }
  }

  /**
   * Si la petición cabe, la cuenta y devuelve `null`; si no, devuelve los segundos de
   * `Retry-After` sin contarla.
   */
  consume(path: string, ip: string, email: unknown, now: number = Date.now()): number | null {
    const rules = this.rules(path, ip, normalizeIdentifier(email));
    const waits = rules.map(([counter, key]) => counter.retryAfterMs(key, now)).filter((ms): ms is number => ms !== null);
    if (waits.length) return toRetryAfterSeconds(Math.max(...waits));
    for (const [counter, key] of rules) counter.hit(key, now);
    return null;
  }

  clear(): void {
    for (const c of [this.signUpPerIp, this.resetPerEmail, this.resetPerIp, this.verifyPerEmailMinute, this.verifyPerEmailHour, this.otherPerIp]) c.clear();
  }
}
