/**
 * Grupos (hogares). Spec 02 §3 (RN-02-01 a RN-02-05) y §5.
 */
import { z } from 'zod';

import { LANE_COLOR_ORDER } from '../constants/index.js';

export const GROUP_NAME_MAX_LENGTH = 40;
export const DEFAULT_GROUP_EMOJI = '🏠';
export const DEFAULT_GROUP_TIMEZONE = 'Europe/Madrid';

/** RN-02-01: 1–40 caracteres tras `trim`. Los nombres no son únicos. */
export const groupNameSchema = z
  .string()
  .trim()
  .min(1, 'Escribe el nombre del hogar')
  .max(GROUP_NAME_MAX_LENGTH, `El nombre puede tener como mucho ${GROUP_NAME_MAX_LENGTH} caracteres`);

const graphemes = new Intl.Segmenter('es', { granularity: 'grapheme' });
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const REGIONAL_INDICATOR = /\p{Regional_Indicator}/u;

/**
 * RN-02-01: exactamente un emoji. Un grafema que contenga un pictograma (incluye los
 * compuestos como `👨‍👩‍👧`) o una bandera (pareja de indicadores regionales).
 */
export function isSingleEmoji(value: string): boolean {
  const segments = Array.from(graphemes.segment(value));
  if (segments.length !== 1) return false;
  const [only] = segments;
  return only !== undefined && (PICTOGRAPHIC.test(only.segment) || REGIONAL_INDICATOR.test(only.segment));
}

export const groupEmojiSchema = z.string().trim().refine(isSingleEmoji, 'Elige un único emoji');

/** Nombre IANA (`Europe/Madrid`, `UTC`, `Etc/GMT+2`); excluye desplazamientos como `+02:00`. */
const IANA_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

/** Zona IANA válida para `Intl` (en el servidor, sin lanzar). */
export function isValidTimezone(value: string): boolean {
  if (!IANA_NAME.test(value)) return false;
  try {
    new Intl.DateTimeFormat('es', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const timezoneSchema = z.string().trim().refine(isValidTimezone, 'Zona horaria no válida');

export const laneColorSchema = z.enum(LANE_COLOR_ORDER);

export const createGroupInput = z.object({
  name: groupNameSchema,
  emoji: groupEmojiSchema.default(DEFAULT_GROUP_EMOJI),
  timezone: timezoneSchema.default(DEFAULT_GROUP_TIMEZONE),
});
export type CreateGroupInput = z.infer<typeof createGroupInput>;

/** Todos opcionales, al menos uno (RN-02-03). */
export const updateGroupInput = z
  .object({
    name: groupNameSchema.optional(),
    emoji: groupEmojiSchema.optional(),
    timezone: timezoneSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.emoji !== undefined || v.timezone !== undefined, 'Indica al menos un dato que cambiar');
export type UpdateGroupInput = z.infer<typeof updateGroupInput>;

export const groupDto = z.object({
  id: z.uuid(),
  name: z.string(),
  emoji: z.string(),
  timezone: z.string(),
  createdById: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type GroupDto = z.infer<typeof groupDto>;

/** Grupo visto por un miembro (`GET /me/groups`, `POST /groups`). */
export const myGroupDto = groupDto.extend({
  memberCount: z.number().int().min(1),
  myLaneColor: laneColorSchema,
  joinedAt: z.iso.datetime(),
});
export type MyGroupDto = z.infer<typeof myGroupDto>;

/** Miembro de un grupo (`GET /groups/:groupId/members`, `group.member.*`). */
export const groupMemberDto = z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  userId: z.uuid(),
  name: z.string(),
  username: z.string().nullable(),
  image: z.string().nullable(),
  laneColor: laneColorSchema,
  joinedAt: z.iso.datetime(),
});
export type GroupMemberDto = z.infer<typeof groupMemberDto>;

/** `PATCH /groups/:groupId/members/me`: el propio color de calle (RN-02-09). */
export const updateMyMemberInput = z.object({ laneColor: laneColorSchema });
export type UpdateMyMemberInput = z.infer<typeof updateMyMemberInput>;
