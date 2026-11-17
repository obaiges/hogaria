export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Envío de emails transaccionales. En test: `FakeEmailSender`; el real (Resend) llega en HOG-054. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
