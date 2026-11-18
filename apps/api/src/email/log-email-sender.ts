import { Logger } from '@nestjs/common';

import type { EmailMessage, EmailSender } from './email-sender.js';

/**
 * Sin `RESEND_API_KEY`/`EMAIL_FROM` (desarrollo): no envía nada, solo deja constancia en
 * el log (sin el cuerpo, que puede llevar enlaces de un solo uso).
 */
export class LogEmailSender implements EmailSender {
  private readonly logger = new Logger('EmailSender');

  send(message: EmailMessage): Promise<void> {
    this.logger.warn(`Email no enviado (sin proveedor configurado): "${message.subject}"`);
    return Promise.resolve();
  }
}
