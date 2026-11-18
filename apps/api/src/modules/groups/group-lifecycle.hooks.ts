import { Injectable, Logger } from '@nestjs/common';

/**
 * Lo que otros módulos necesitan saber del ciclo de vida de un grupo. Se llama
 * **después** del commit. E12 (recordatorios) registra `onGroupTimezoneChanged` para
 * recalcularlos (spec 02, RN-02-04); hasta entonces el registro está vacío.
 */
export interface GroupLifecycleListener {
  name: string;
  onGroupTimezoneChanged?: (groupId: string) => Promise<void> | void;
}

@Injectable()
export class GroupLifecycleHooks {
  private readonly logger = new Logger(GroupLifecycleHooks.name);
  private readonly listeners: GroupLifecycleListener[] = [];

  register(listener: GroupLifecycleListener): void {
    this.listeners.push(listener);
  }

  /** Avisa a los módulos registrados. Un fallo se registra y no afecta a la petición. */
  async onGroupTimezoneChanged(groupId: string): Promise<void> {
    for (const listener of this.listeners) {
      if (!listener.onGroupTimezoneChanged) continue;
      try {
        await listener.onGroupTimezoneChanged(groupId);
      } catch (error) {
        this.logger.warn({ err: error, listener: listener.name, groupId }, 'Falló onGroupTimezoneChanged');
      }
    }
  }
}
