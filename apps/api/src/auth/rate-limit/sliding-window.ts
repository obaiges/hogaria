/**
 * Contador de ventana deslizante en memoria (un solo proceso de API; se reinicia al
 * reiniciar, spec 01 RN-01-26/27). Guarda los instantes de cada golpe por clave.
 */
export class SlidingWindowCounter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
  ) {}

  private recent(key: string, now: number): number[] {
    const list = this.hits.get(key);
    if (!list) return [];
    const from = now - this.windowMs;
    const fresh = list.filter((t) => t > from);
    if (fresh.length) this.hits.set(key, fresh);
    else this.hits.delete(key);
    return fresh;
  }

  /** Milisegundos hasta que vuelva a haber hueco, o `null` si no se ha llegado al límite. */
  retryAfterMs(key: string, now: number = Date.now()): number | null {
    const recent = this.recent(key, now);
    if (recent.length < this.limit) return null;
    // El hueco se abre cuando caduca el golpe más antiguo de los `limit` últimos.
    const oldest = recent[recent.length - this.limit]!;
    return Math.max(1, oldest + this.windowMs - now);
  }

  hit(key: string, now: number = Date.now()): void {
    const recent = this.recent(key, now);
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.sweep(now);
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  clear(): void {
    this.hits.clear();
  }

  /** Borra las claves sin golpes en la ventana (evita que el mapa crezca sin límite). */
  private sweep(now: number): void {
    for (const key of [...this.hits.keys()]) this.recent(key, now);
  }
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;

export function toRetryAfterSeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

/** Email o username normalizado para las claves (sin espacios y en minúsculas). */
export function normalizeIdentifier(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
