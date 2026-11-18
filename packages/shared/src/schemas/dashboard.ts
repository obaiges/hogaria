/**
 * Inicio ("Hoy"), spec 15 §5: `GET /groups/:groupId/dashboard?date=YYYY-MM-DD`.
 * Las claves opcionales solo aparecen si su módulo ha registrado el provider (RN-15-20).
 */
import { z } from 'zod';

import { BILL_CATEGORIES, EVENT_CATEGORIES, MEAL_SLOTS } from '../constants/index.js';
import { isIsoDay } from '../dates.js';
import { activityDto } from './activity.js';
import { laneColorSchema } from './groups.js';

export const dashboardQuery = z.object({
  /** Fecha válida `YYYY-MM-DD`; si falta, hoy en la zona del grupo (RN-15-19). */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD')
    .refine(isIsoDay, 'La fecha no existe')
    .optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuery>;

export const dashboardMemberDto = z.object({
  userId: z.uuid(),
  name: z.string(),
  /** `null` si no hay o si el usuario prefiere iniciales (spec 16). */
  image: z.url().nullable(),
  laneColor: laneColorSchema,
  isMe: z.boolean(),
});
export type DashboardMemberDto = z.infer<typeof dashboardMemberDto>;

export const shiftTodayDto = z.object({
  status: z.enum(['WORKING', 'DAY_OFF', 'VACATION', 'SICK', 'NO_SCHEDULE']),
  slots: z.array(
    z.object({
      startTime: z.string(),
      endTime: z.string(),
      /** `endTime <= startTime`. */
      endsNextDay: z.boolean(),
      label: z.string().nullable(),
    }),
  ),
  /** Nota de la excepción del día, si la hay. */
  note: z.string().nullable(),
});
export type ShiftTodayDto = z.infer<typeof shiftTodayDto>;

export const taskTodayDto = z.object({
  id: z.uuid(),
  title: z.string(),
  emoji: z.string().nullable(),
  dueAt: z.iso.datetime(),
  allDay: z.boolean(),
  overdue: z.boolean(),
});
export type TaskTodayDto = z.infer<typeof taskTodayDto>;

export const eventTodayDto = z.object({
  id: z.uuid(),
  title: z.string(),
  category: z.enum(EVENT_CATEGORIES),
  allDay: z.boolean(),
  occurrenceStart: z.iso.datetime(),
  occurrenceEnd: z.iso.datetime(),
  location: z.string().nullable(),
});
export type EventTodayDto = z.infer<typeof eventTodayDto>;

/** Lista recortada de una calle: como mucho N elementos + cuántos más hay. */
const laneListOf = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item), moreCount: z.number().int() });

export const laneDto = z.object({
  /** `null` = "Sin asignar" (RN-15-22). */
  userId: z.uuid().nullable(),
  /** E08; nunca en la calle "Sin asignar". */
  shift: shiftTodayDto.optional(),
  /** E07. */
  tasks: laneListOf(taskTodayDto).optional(),
  /** E09. */
  events: laneListOf(eventTodayDto).optional(),
});
export type LaneDto = z.infer<typeof laneDto>;

export const dashboardMealsDto = z.object({
  entries: z.array(
    z.object({
      id: z.uuid(),
      slot: z.enum(MEAL_SLOTS),
      title: z.string(),
      recipeId: z.uuid().nullable(),
      forUserIds: z.array(z.uuid()),
    }),
  ),
});

export const dashboardBillsDto = z.object({
  items: z.array(
    z.object({
      billPaymentId: z.uuid(),
      billId: z.uuid(),
      name: z.string(),
      category: z.enum(BILL_CATEGORIES),
      /** `YYYY-MM-DD`. */
      periodDueDate: z.string(),
      amountCents: z.number().int().nullable(),
      overdue: z.boolean(),
    }),
  ),
  moreCount: z.number().int(),
  totalCents: z.number().int(),
});

export const dashboardShoppingDto = z.object({
  lists: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      emoji: z.string().nullable(),
      pendingCount: z.number().int(),
    }),
  ),
  totalPending: z.number().int(),
});

export const dashboardDto = z.object({
  /** `YYYY-MM-DD`. */
  date: z.string(),
  timezone: z.string(),
  members: z.array(dashboardMemberDto),
  lanes: z.array(laneDto),
  /** Las 5 más recientes (RN-15-29). */
  activity: z.array(activityDto),
  meals: dashboardMealsDto.optional(),
  bills: dashboardBillsDto.optional(),
  shopping: dashboardShoppingDto.optional(),
});
export type DashboardDto = z.infer<typeof dashboardDto>;
