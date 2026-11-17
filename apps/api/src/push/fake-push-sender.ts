import type { PushPayload, PushResult, PushSender, PushTarget } from './push-sender.js';

export interface RecordedPush {
  userId: string;
  endpoint: string | null;
  payload: PushPayload;
  result: PushResult;
}

/**
 * Registra los envíos en memoria. `sendToUser` usa las suscripciones dadas con
 * `setSubscriptions()` (por defecto, ninguna). `failWith()` simula 'gone' o 'error'.
 */
export class FakeWebPushSender implements PushSender {
  readonly sent: RecordedPush[] = [];
  private subscriptions: PushTarget[] = [];
  private readonly forced = new Map<string, PushResult>();

  setSubscriptions(subscriptions: PushTarget[]): void {
    this.subscriptions = [...subscriptions];
  }

  /** Hace que los envíos a `endpoint` devuelvan `result`. */
  failWith(endpoint: string, result: Exclude<PushResult, 'ok'>): void {
    this.forced.set(endpoint, result);
  }

  send(subscription: PushTarget, payload: PushPayload): Promise<PushResult> {
    const result = this.forced.get(subscription.endpoint) ?? 'ok';
    this.sent.push({ userId: subscription.userId, endpoint: subscription.endpoint, payload, result });
    return Promise.resolve(result);
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
    const targets = this.subscriptions.filter((s) => s.userId === userId);
    const results = await Promise.all(targets.map((t) => this.send(t, payload)));
    const sent = results.filter((r) => r === 'ok').length;
    return { sent, failed: results.length - sent };
  }

  to(userId: string): RecordedPush[] {
    return this.sent.filter((p) => p.userId === userId);
  }

  clear(): void {
    this.sent.length = 0;
    this.subscriptions = [];
    this.forced.clear();
  }
}

/** Nombre usado en los tickets de E12. */
export { FakeWebPushSender as FakePushSender };
