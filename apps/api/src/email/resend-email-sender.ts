import { Resend } from 'resend';

import type { EmailMessage, EmailSender } from './email-sender.js';

/** Lo que usamos del SDK de Resend (los tests unitarios pasan un doble). */
export interface ResendEmailsApi {
  send(payload: { from: string; to: string; subject: string; text: string; html: string }): Promise<{ error: { name?: string; message: string } | null }>;
}

export class EmailSendError extends Error {
  override readonly name = 'EmailSendError';
}

/**
 * Envío real con Resend (HOG-054). Plan gratuito: 100 emails/día (docs/06). `from` es
 * `EMAIL_FROM`. Si Resend falla, lanza `EmailSendError` (sin el cuerpo ni el
 * destinatario en el mensaje): quien llama decide si lo registra y sigue.
 */
export class ResendEmailSender implements EmailSender {
  private readonly emails: ResendEmailsApi;

  constructor(
    apiKey: string,
    private readonly from: string,
    emails?: ResendEmailsApi,
  ) {
    this.emails = emails ?? new Resend(apiKey).emails;
  }

  async send({ to, subject, text, html }: EmailMessage): Promise<void> {
    let result: Awaited<ReturnType<ResendEmailsApi['send']>>;
    try {
      result = await this.emails.send({ from: this.from, to, subject, text, html });
    } catch (error) {
      throw new EmailSendError(`Resend no ha podido enviar "${subject}": ${error instanceof Error ? error.message : String(error)}`);
    }
    if (result.error) {
      throw new EmailSendError(`Resend ha rechazado "${subject}": ${result.error.name ?? 'error'}: ${result.error.message}`);
    }
  }
}
