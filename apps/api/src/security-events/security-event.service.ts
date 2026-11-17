import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

import type { SecurityEventType } from '@prisma/client';

export interface SecurityEventData {
  userId?: string | null;
  /** Email/username intentado (fallos de login) o id del administrador (bloqueos). */
  identifier?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** Interfaz mínima que usa Better Auth (createAuth) para registrar eventos. */
export interface SecurityEventRecorder {
  record(type: SecurityEventType, data: SecurityEventData): Promise<void>;
}

/**
 * Registro de `SecurityEvent` (spec 01, RN-01-28). Nunca guarda contraseñas, tokens ni
 * cookies. Un fallo al escribir no rompe la operación de autenticación: se registra en
 * el log. La purga de 180 días es de `RetentionJob` (HOG-153).
 */
@Injectable()
export class SecurityEventService implements SecurityEventRecorder {
  private readonly logger = new Logger(SecurityEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(type: SecurityEventType, data: SecurityEventData): Promise<void> {
    try {
      await this.prisma.securityEvent.create({
        data: {
          type,
          userId: data.userId ?? null,
          identifier: data.identifier?.slice(0, 254) ?? null,
          ipAddress: data.ip ?? null,
          userAgent: data.userAgent?.slice(0, 512) ?? null,
        },
      });
    } catch (error) {
      this.logger.error(`No se pudo registrar el SecurityEvent ${type}`, error instanceof Error ? error.stack : String(error));
    }
  }
}
