import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FakeGeminiClient } from './ai/fake-gemini.client.js';
import { GEMINI_CLIENT } from './ai/gemini-client.js';
import { UnavailableGeminiClient } from './ai/unavailable-gemini.client.js';
import { EMAIL_SENDER } from './email/email-sender.js';
import { FakeEmailSender } from './email/fake-email-sender.js';
import { LogEmailSender } from './email/log-email-sender.js';
import { DisabledPushSender } from './push/disabled-push-sender.js';
import { FakeWebPushSender } from './push/fake-push-sender.js';
import { PUSH_SENDER } from './push/push-sender.js';

const isTest = (config: ConfigService) => config.get<string>('NODE_ENV') === 'test';

/**
 * Servicios externos detrás de *tokens* de Nest. Con `NODE_ENV=test` se usan los *fakes*
 * (nunca se llama a Resend, Web Push ni Gemini). Las implementaciones reales sustituyen
 * a las provisionales en HOG-054 (email), HOG-604 (push) y HOG-650 (Gemini).
 */
@Global()
@Module({
  providers: [
    {
      provide: EMAIL_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => (isTest(config) ? new FakeEmailSender() : new LogEmailSender()),
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
