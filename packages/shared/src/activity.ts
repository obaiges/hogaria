/**
 * Registro de actividad (spec 03 §4, RN-03-25). Cada épica puede añadir valores en su ticket.
 */

/** Tipo de entidad de una entrada de actividad (`ActivityLog.entityType`). */
export const ACTIVITY_ENTITY_TYPES = [
  'group',
  'group_member',
  'group_invite',
  'shopping_list',
  'shopping_item',
  'product',
  'recipe',
  'meal_plan_entry',
  'task',
  'calendar_event',
  'expense',
  'expense_category',
  'budget',
  'bill',
  'bill_payment',
] as const;

export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

/** Acción de una entrada de actividad (`ActivityLog.action`). */
export const ACTIVITY_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'checked',
  'unchecked',
  'cleared',
  'completed',
  'skipped',
  'joined',
  'left',
  'removed',
  'revoked',
  'paid',
  'unpaid',
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

/** Días que se conserva la actividad (RN-03-24). */
export const ACTIVITY_RETENTION_DAYS = 90;

/** Longitud máxima de `summary` (RN-03-25). */
export const ACTIVITY_SUMMARY_MAX = 200;

export function isActivityEntityType(value: unknown): value is ActivityEntityType {
  return typeof value === 'string' && (ACTIVITY_ENTITY_TYPES as readonly string[]).includes(value);
}

export function isActivityAction(value: unknown): value is ActivityAction {
  return typeof value === 'string' && (ACTIVITY_ACTIONS as readonly string[]).includes(value);
}
