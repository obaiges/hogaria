import { Logger } from '@nestjs/common';

import type { PushPayload, PushResult, PushSender, PushTarget } from './push-sender.js';

/** Provisional hasta HOG-604: la API arranca, avisa y no envía (como sin claves VAPID). */
export class DisabledPushSender implements PushSender {
  private readonly logger = new Logger('PushSender');

  send(_subscription: PushTarget, _payload: PushPayload): Promise<PushResult> {
    this.logger.warn('Push no enviado: Web Push no está configurado');
    return Promise.resolve('error');
  }

  sendToUser(_userId: string, _payload: PushPayload): Promise<{ sent: number; failed: number }> {
    this.logger.warn('Push no enviado: Web Push no está configurado');
    return Promise.resolve({ sent: 0, failed: 0 });
  }
}
