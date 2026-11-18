import { Injectable } from '@nestjs/common';

/**
 * Tarea que se ejecuta en cada tick del `MaintenanceCron` (spec 03, RN-03-25).
 * Órdenes previstos: `bills.materialize` 10 (E11), `retention.purge` 20 (E03),
 * `assistant.purge` 30 (E14), `reminders.reconcile` 100 (E12).
 */
export interface SchedulerTickHandler {
  name: string;
  /** Menor = antes. */
  order: number;
  run: (now: Date) => Promise<void>;
}

/**
 * Registro de las tareas del único cron que toca la BBDD (ADR-004). Los módulos registran
 * sus handlers en `onModuleInit`; ninguno crea un cron propio.
 */
@Injectable()
export class SchedulerTickRegistry {
  private readonly handlers = new Map<string, SchedulerTickHandler>();

  register(handler: SchedulerTickHandler): void {
    if (this.handlers.has(handler.name)) throw new Error(`SchedulerTickRegistry: "${handler.name}" ya está registrado`);
    this.handlers.set(handler.name, handler);
  }

  /** Handlers por `order` ascendente (a igualdad, por nombre). */
  list(): SchedulerTickHandler[] {
    return [...this.handlers.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }
}
