/**
 * Tiempo real (docs/04-api-y-tiempo-real.md §Tiempo real).
 * Todos los eventos viajan por el canal único `"evt"` con un `RealtimeEnvelope`.
 */

export const REALTIME_CHANNEL = 'evt';
export const REALTIME_PATH = '/realtime';

/** Catálogo completo de eventos. Añadir un evento implica actualizar docs/04 en el mismo commit. */
export const REALTIME_EVENTS = [
  // Grupos e invitaciones
  'group.updated',
  'group.member.joined',
  'group.member.updated',
  'group.member.left',
  'invite.created',
  'invite.revoked',
  'invite.used',
  // Actividad
  'activity.created',
  // Compra
  'shopping.list.created',
  'shopping.list.updated',
  'shopping.list.deleted',
  'shopping.item.created',
  'shopping.item.updated',
  'shopping.item.deleted',
  'shopping.items.bulk_created',
  'shopping.items.bulk_deleted',
  'product.updated',
  'product.deleted',
  // Recetas y comidas
  'recipe.created',
  'recipe.updated',
  'recipe.deleted',
  'meal.created',
  'meal.updated',
  'meal.deleted',
  // Tareas
  'task.created',
  'task.updated',
  'task.deleted',
  'task.completed',
  'task.skipped',
  // Calendario, horarios y dieta
  'event.created',
  'event.updated',
  'event.deleted',
  'schedule.updated',
  'diet.updated',
  // Gastos y facturas
  'expense.created',
  'expense.updated',
  'expense.deleted',
  'expense_category.changed',
  'budget.changed',
  'bill.created',
  'bill.updated',
  'bill.deleted',
  'bill_payment.updated',
  // IA
  'ai.quota.updated',
  // Sesión (sala user:<id>, groupId null)
  'session.revoked',
] as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[number];

export function isRealtimeEventName(value: unknown): value is RealtimeEventName {
  return typeof value === 'string' && (REALTIME_EVENTS as readonly string[]).includes(value);
}

/**
 * Tipos de `data` por evento. Cada épica lo amplía por *declaration merging* cuando define
 * sus DTO (HOG-151 y siguientes):
 *
 * ```ts
 * declare module '@hogaria/shared' {
 *   interface RealtimeEventDataMap { 'task.created': TaskDto }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- se amplía por declaration merging
export interface RealtimeEventDataMap {}

/** `data` de un evento: el tipo registrado en `RealtimeEventDataMap` o `unknown`. */
export type RealtimeEventData<E extends RealtimeEventName> = E extends keyof RealtimeEventDataMap
  ? RealtimeEventDataMap[E]
  : unknown;

export interface RealtimeEnvelope<T = unknown, E extends RealtimeEventName = RealtimeEventName> {
  event: E;
  /** `null` solo en eventos de la sala `user:<id>` que no son de un grupo (`session.revoked`). */
  groupId: string | null;
  /** `null` = sistema (scheduler). */
  actorId: string | null;
  clientMutationId: string | null;
  /** ISO 8601 UTC. */
  at: string;
  /** DTO completo del recurso (o `{ id }` en los `*.deleted`). */
  data: T;
}

/** Sobre con `data` tipado según el evento. */
export type TypedRealtimeEnvelope<E extends RealtimeEventName> = RealtimeEnvelope<
  RealtimeEventData<E>,
  E
>;
