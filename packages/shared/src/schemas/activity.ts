/**
 * Actividad del grupo (spec 03 §5). `GET /groups/:groupId/activity` y evento `activity.created`.
 */
import { z } from 'zod';

import { ACTIVITY_ACTIONS, ACTIVITY_ENTITY_TYPES, ACTIVITY_SUMMARY_MAX } from '../activity.js';
import { cursorQuery } from './pagination.js';

export const activityDto = z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  /** `null` = sistema (scheduler). */
  actorId: z.uuid().nullable(),
  /** `null` si es del sistema o la cuenta del autor ya no existe (RN-03-28). */
  actorName: z.string().nullable(),
  entityType: z.enum(ACTIVITY_ENTITY_TYPES),
  entityId: z.uuid(),
  action: z.enum(ACTIVITY_ACTIONS),
  /** Español, sin el nombre del actor y en minúscula inicial ("añadió Leche a Compra"). */
  summary: z.string().max(ACTIVITY_SUMMARY_MAX),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.iso.datetime(),
});

export type ActivityDto = z.infer<typeof activityDto>;

/** `?cursor=&limit=` (por defecto 50, máximo 100), cursor sobre `id` descendente (RN-03-30). */
export const activityQuery = cursorQuery;

export type ActivityQuery = z.infer<typeof activityQuery>;
