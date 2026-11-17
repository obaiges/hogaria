import { HOUR_MS, MINUTE_MS, normalizeIdentifier, SlidingWindowCounter, toRetryAfterSeconds } from './sliding-window.js';

/**
 * Fuerza bruta en `/sign-in/email` y `/sign-in/username` (RN-01-26), contando **solo
 * intentos fallidos**: 5 por minuto por (IP + identificador) y 20 por hora por
 * identificador. Un login correcto pone a cero el contador de (IP + identificador).
 */
export class LoginRateLimiter {
  readonly perIpAndIdentifier = new SlidingWindowCounter(5, MINUTE_MS);
  readonly perIdentifier = new SlidingWindowCounter(20, HOUR_MS);

  private keys(ip: string, identifier: unknown) {
    const id = normalizeIdentifier(identifier);
    return { pair: `${ip}|${id}`, id };
  }

  /** Segundos de `Retry-After` si el próximo intento debe rechazarse, o `null`. */
  check(ip: string, identifier: unknown, now: number = Date.now()): number | null {
    const { pair, id } = this.keys(ip, identifier);
    const waits = [this.perIpAndIdentifier.retryAfterMs(pair, now), id ? this.perIdentifier.retryAfterMs(id, now) : null].filter(
      (ms): ms is number => ms !== null,
    );
    return waits.length ? toRetryAfterSeconds(Math.max(...waits)) : null;
  }

  recordFailure(ip: string, identifier: unknown, now: number = Date.now()): void {
    const { pair, id } = this.keys(ip, identifier);
    this.perIpAndIdentifier.hit(pair, now);
    if (id) this.perIdentifier.hit(id, now);
  }

  recordSuccess(ip: string, identifier: unknown): void {
    this.perIpAndIdentifier.reset(this.keys(ip, identifier).pair);
  }

  clear(): void {
    this.perIpAndIdentifier.clear();
    this.perIdentifier.clear();
  }
}
