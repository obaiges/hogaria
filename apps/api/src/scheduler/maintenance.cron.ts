import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { SchedulerTickRegistry } from './scheduler-tick.registry.js';

export interface TickResult {
  /** `false` si ya había un tick en curso y este se ha saltado. */
  ran: boolean;
  failed: string[];
}

/**
 * El **único** cron de la API que toca la BBDD (spec 03, RN-03-25; ADR-004): cada 6 h,
 * en hora de Madrid, ejecuta los handlers del `SchedulerTickRegistry` por `order`.
 * - Un handler que falla se registra y no detiene a los siguientes.
 * - Si un tick sigue en curso cuando llega el siguiente, este se salta (sin solapes).
 */
@Injectable()
export class MaintenanceCron {
  private readonly logger = new Logger(MaintenanceCron.name);
  private running = false;

  constructor(private readonly registry: SchedulerTickRegistry) {}

  @Cron('0 0 */6 * * *', { name: 'maintenance', timeZone: 'Europe/Madrid' })
  async tick(): Promise<void> {
    await this.runNow();
  }

  /** Ejecuta un tick ya (E12 lo llama al arrancar). */
  async runNow(now: Date = new Date()): Promise<TickResult> {
    if (this.running) {
      this.logger.warn('Tick de mantenimiento saltado: el anterior sigue en curso');
      return { ran: false, failed: [] };
    }
    this.running = true;
    const failed: string[] = [];
    try {
      for (const handler of this.registry.list()) {
        try {
          await handler.run(now);
        } catch (error) {
          failed.push(handler.name);
          this.logger.error({ err: error, handler: handler.name }, 'Falló una tarea de mantenimiento');
        }
      }
    } finally {
      this.running = false;
    }
    return { ran: true, failed };
  }
}
