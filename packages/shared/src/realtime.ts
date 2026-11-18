/**
 * Tiempo real (docs/04-api-y-tiempo-real.md §Tiempo real).
 * Todos los eventos viajan por el canal único `"evt"` con un `RealtimeEnvelope`.
 */
import { z } from 'zod';

import { activityDto, type ActivityDto } from './schemas/activity.js';

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
 * Tipo de `data` de cada evento publicable (spec 03, RN-03-12/13). Cada ticket que
 * publica un evento añade aquí su entrada **y** su esquema en `REALTIME_EVENT_SCHEMAS`
 * (p. ej. HOG-100 `'group.updated': GroupDto`). El `RealtimePublisher` solo acepta
 * eventos con entrada: publicar uno sin ella no compila.
 */
export interface RealtimeEventDataMap {
  /** Tras el commit de cualquier mutación que escribe `ActivityLog` (HOG-153). */
  'activity.created': ActivityDto;
  /** Sala `user:<id>`, `groupId: null`: el cliente cierra la sesión local. */
  'session.revoked': Record<string, never>;
}

/** Eventos que ya se pueden publicar (tienen `data` y esquema). */
export type PublishableRealtimeEvent = keyof RealtimeEventDataMap;

/**
 * Esquemas zod de `data` por evento. El publisher los usa fuera de producción para
 * detectar DTOs incompletos en los tests (RN-03-12).
 */
export const REALTIME_EVENT_SCHEMAS: { [E in PublishableRealtimeEvent]: z.ZodType<RealtimeEventDataMap[E]> } = {
  'activity.created': activityDto,
  'session.revoked': z.strictObject({}) as z.ZodType<Record<string, never>>,
};

/** Error de compilación si el mapa tiene un evento que no está en `REALTIME_EVENTS`. */
type AssertMapKeysAreEvents<T extends RealtimeEventName> = T;
export type _RealtimeMapKeysCheck = AssertMapKeysAreEvents<PublishableRealtimeEvent>;

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
