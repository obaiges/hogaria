import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EMAIL_SENDER, type EmailSender } from '../email/email-sender.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUTH, createAuth } from './auth.js';

/** Instancia de Better Auth (token `AUTH`); `configureApp` la monta en `/api/auth/*`. */
@Global()
@Module({
  providers: [
    {
      provide: AUTH,
      inject: [PrismaService, EMAIL_SENDER, ConfigService],
      useFactory: (prisma: PrismaService, emailSender: EmailSender, config: ConfigService) =>
        createAuth({
          prisma,
          emailSender,
          env: {
            NODE_ENV: config.get('NODE_ENV'),
            APP_URL: config.get('APP_URL'),
            API_URL: config.get('API_URL'),
            COOKIE_DOMAIN: config.get('COOKIE_DOMAIN'),
            BETTER_AUTH_SECRET: config.get('BETTER_AUTH_SECRET'),
          },
        }),
    },
  ],
  exports: [AUTH],
})
export class AuthModule {}
