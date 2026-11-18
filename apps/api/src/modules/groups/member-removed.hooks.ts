import { Injectable } from '@nestjs/common';

import type { Prisma } from '@prisma/client';

export interface MemberRemovedContext {
  groupId: string;
  userId: string;
}

/**
 * Limpieza del contenido personal de quien sale o es expulsado (spec 02, RN-02-22, ADR-019).
 * Cada módulo registra su manejador al arrancar; se ejecuta **dentro** de la transacción de
 * salida, así que si uno falla no se borra nada. Los manejadores no emiten eventos ni actividad:
 * los clientes invalidan sus queries al recibir `group.member.left`.
 */
export interface MemberRemovedHandler {
  name: string;
  onMemberRemoved: (tx: Prisma.TransactionClient, ctx: MemberRemovedContext) => Promise<void>;
}

@Injectable()
export class MemberRemovedHooks {
  private readonly handlers: MemberRemovedHandler[] = [];

  register(handler: MemberRemovedHandler): void {
    this.handlers.push(handler);
  }

  /** En orden de registro. Un error se propaga para deshacer la transacción. */
  async run(tx: Prisma.TransactionClient, ctx: MemberRemovedContext): Promise<void> {
    for (const handler of this.handlers) {
      await handler.onMemberRemoved(tx, ctx);
    }
  }
}
