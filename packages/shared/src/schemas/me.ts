/**
 * `GET /api/v1/me` (spec 01 §5.2). E16 amplía este mismo esquema con `googleImage`,
 * `preferInitialsAvatar` y `linkedProviders` (spec 16 §5).
 */
import { z } from 'zod';

export const meDto = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  username: z.string().nullable(),
  displayUsername: z.string().nullable(),
  image: z.string().nullable(),
  isPlatformAdmin: z.boolean(),
  /** Instante ISO 8601 UTC en que aceptó el aviso de privacidad de IA. */
  aiNoticeAcceptedAt: z.iso.datetime().nullable(),
  /** Tiene cuenta `credential` (puede cambiar la contraseña, RN-01-19). */
  hasPassword: z.boolean(),
  /** Tiene cuenta de Google vinculada. */
  hasGoogle: z.boolean(),
  createdAt: z.iso.datetime(),
});

export type MeDto = z.infer<typeof meDto>;

/**
 * Dispositivo con sesión abierta (Perfil → Seguridad, spec 01 §5). Lo construye la web a
 * partir de `authClient.listSessions()`; `deviceLabel` sale de `describeUserAgent`.
 */
export const sessionDto = z.object({
  id: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  deviceLabel: z.string(),
  isCurrent: z.boolean(),
  /** Token de la sesión: lo pide `POST /api/auth/revoke-session`. */
  token: z.string(),
});

export type SessionDto = z.infer<typeof sessionDto>;
