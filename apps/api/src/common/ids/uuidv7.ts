import { randomBytes } from 'node:crypto';

/**
 * UUID versión 7 (RFC 9562): 48 bits de milisegundos Unix + aleatorio. Ordenable por
 * tiempo, como los `@default(uuid(7))` de Prisma (docs/02). Lo usa Better Auth para
 * los ids que genera él (usuarios, sesiones, cuentas y verificaciones).
 */
export function uuidv7(now: number = Date.now()): string {
  const bytes = randomBytes(16);
  let ms = BigInt(now);
  for (let i = 5; i >= 0; i--) {
    bytes[i] = Number(ms & 0xffn);
    ms >>= 8n;
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // versión 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variante RFC 9562
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
