export const PUSH_SENDER = Symbol('PUSH_SENDER');

/** Suscripción Web Push tal como la guarda `PushSubscription` (docs/02). */
export interface PushTarget {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Payload JSON del aviso (≤ 3 KB; spec 12, RN-12-22). */
export type PushPayload = Record<string, unknown>;

export type PushResult = 'ok' | 'gone' | 'error';

/** Envío Web Push. En test: `FakeWebPushSender`; el real (`web-push`) llega en HOG-604. */
export interface PushSender {
  send(subscription: PushTarget, payload: PushPayload): Promise<PushResult>;
  sendToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }>;
}
