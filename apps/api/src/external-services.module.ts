import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FakeGeminiClient } from './ai/fake-gemini.client.js';
import { GEMINI_CLIENT } from './ai/gemini-client.js';
import { UnavailableGeminiClient } from './ai/unavailable-gemini.client.js';
import { EMAIL_SENDER, type EmailSender } from './email/email-sender.js';
import { FakeEmailSender } from './email/fake-email-sender.js';
import { LogEmailSender } from './email/log-email-sender.js';
import { ResendEmailSender } from './email/resend-email-sender.js';
import { DisabledPushSender } from './push/disabled-push-sender.js';
import { FakeWebPushSender } from './push/fake-push-sender.js';
import { PUSH_SENDER } from './push/push-sender.js';

const isTest = (config: ConfigService) => config.get<string>('NODE_ENV') === 'test';

/** Test → fake; con `RESEND_API_KEY` y `EMAIL_FROM` → Resend; si faltan → solo log (desarrollo). */
export function createEmailSender(config: ConfigService): EmailSender {
  if (isTest(config)) return new FakeEmailSender();
  const apiKey = config.get<string>('RESEND_API_KEY')?.trim();
  const from = config.get<string>('EMAIL_FROM')?.trim();
  if (apiKey && from) return new ResendEmailSender(apiKey, from);
  if (config.get<string>('NODE_ENV') === 'production') {
    new Logger('EmailSender').error('Faltan RESEND_API_KEY o EMAIL_FROM: no se enviarán emails (verificación ni recuperación)');
  }
  return new LogEmailSender();
}

/**
 * Servicios externos detrás de *tokens* de Nest. Con `NODE_ENV=test` se usan los *fakes*
 * (nunca se llama a Resend, Web Push ni Gemini). Las implementaciones reales de push y
 * Gemini sustituyen a las provisionales en HOG-604 y HOG-650.
 */
@Global()
@Module({
  providers: [
    {
      provide: EMAIL_SENDER,
      inject: [ConfigService],
      useFactory: createEmailSender,
    },
    {
      provide: PUSH_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => (isTest(config) ? new FakeWebPushSender() : new DisabledPushSender()),
    },
    {
      provide: GEMINI_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => (isTest(config) ? new FakeGeminiClient() : new UnavailableGeminiClient()),
    },
  ],
  exports: [EMAIL_SENDER, PUSH_SENDER, GEMINI_CLIENT],
})
export class ExternalServicesModule {}
