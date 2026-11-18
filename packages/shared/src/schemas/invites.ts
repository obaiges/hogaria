/**
 * Invitaciones (spec 02, RN-02-10 a RN-02-19 y §5).
 */
import { z } from 'zod';

export const inviteStatusSchema = z.enum(['ACTIVE', 'USED', 'REVOKED', 'EXPIRED']);

/** Invitación tal como la ven los miembros. Nunca lleva el token (RN-02-11). */
export const groupInviteDto = z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  status: inviteStatusSchema,
  createdById: z.uuid().nullable(),
  createdByName: z.string().nullable(),
  usedById: z.uuid().nullable(),
  usedByName: z.string().nullable(),
  expiresAt: z.iso.datetime(),
  usedAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type GroupInviteDto = z.infer<typeof groupInviteDto>;

/** Respuesta de `POST /groups/:groupId/invites`: el **único** sitio donde va el token en claro. */
export const createdGroupInviteDto = z.object({
  invite: groupInviteDto,
  token: z.string(),
  url: z.string(),
});
export type CreatedGroupInviteDto = z.infer<typeof createdGroupInviteDto>;

/** `GET /invites/:token` (público). `groupId` solo si `alreadyMember`. */
export const publicInviteDto = z.object({
  groupName: z.string(),
  groupEmoji: z.string(),
  invitedByName: z.string().nullable(),
  expiresAt: z.iso.datetime(),
  alreadyMember: z.boolean(),
  groupId: z.uuid().nullable(),
});
export type PublicInviteDto = z.infer<typeof publicInviteDto>;

export const acceptInviteResultDto = z.object({
  groupId: z.uuid(),
  alreadyMember: z.boolean(),
});
export type AcceptInviteResultDto = z.infer<typeof acceptInviteResultDto>;
