import type { EmailMessage, EmailSender } from './email-sender.js';

export interface SentEmail extends EmailMessage {
  /** Enlaces http(s) encontrados en el texto y el HTML, sin duplicados y en orden. */
  links: string[];
  sentAt: Date;
}

const URL_RE = /https?:\/\/[^\s"'<>]+/g;

export function extractLinks(...parts: string[]): string[] {
  const found = parts.flatMap((p) => p.match(URL_RE) ?? []).map((u) => u.replace(/&amp;/g, '&'));
  return [...new Set(found)];
}

/** Guarda los emails en memoria. Se usa con `NODE_ENV=test` y en los tests de integración. */
export class FakeEmailSender implements EmailSender {
  readonly sent: SentEmail[] = [];

  send(message: EmailMessage): Promise<void> {
    this.sent.push({ ...message, links: extractLinks(message.text, message.html), sentAt: new Date() });
    return Promise.resolve();
  }

  /** Emails enviados a `to` (sin distinguir mayúsculas), del más antiguo al más reciente. */
  to(to: string): SentEmail[] {
    const needle = to.toLowerCase();
    return this.sent.filter((e) => e.to.toLowerCase() === needle);
  }

  last(to?: string): SentEmail | undefined {
    const list = to ? this.to(to) : this.sent;
    return list[list.length - 1];
  }

  clear(): void {
    this.sent.length = 0;
  }
}
