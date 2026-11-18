export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Envío de emails transaccionales: `ResendEmailSender`; en test, `FakeEmailSender`. Puede lanzar si el proveedor falla. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
