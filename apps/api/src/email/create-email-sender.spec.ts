import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { createEmailSender } from '../external-services.module.js';
import { FakeEmailSender } from './fake-email-sender.js';
import { LogEmailSender } from './log-email-sender.js';
import { ResendEmailSender } from './resend-email-sender.js';

const config = (env: Record<string, string>) => new ConfigService(env);
const RESEND = { RESEND_API_KEY: 're_test', EMAIL_FROM: 'Hogaria <no-reply@hogaria.test>' };

describe('createEmailSender', () => {
  it('en test usa siempre el fake, aunque haya clave de Resend', () => {
    expect(createEmailSender(config({ NODE_ENV: 'test', ...RESEND }))).toBeInstanceOf(FakeEmailSender);
  });

  it('con RESEND_API_KEY y EMAIL_FROM usa Resend', () => {
    expect(createEmailSender(config({ NODE_ENV: 'production', ...RESEND }))).toBeInstanceOf(ResendEmailSender);
  });

  it('sin configuración de Resend solo deja constancia en el log', () => {
    expect(createEmailSender(config({ NODE_ENV: 'development' }))).toBeInstanceOf(LogEmailSender);
    expect(createEmailSender(config({ NODE_ENV: 'development', RESEND_API_KEY: 're_test' }))).toBeInstanceOf(LogEmailSender);
  });
});
