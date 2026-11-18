import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EMAIL_SENDER, type EmailSender } from '../email/email-sender.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SecurityEventService } from '../security-events/security-event.service.js';
import { AUTH, createAuth } from './auth.js';
import { SignupInviteConsumerRef } from './invite-hooks.js';
import { AuthRequestLimiter } from './rate-limit/auth-request-limiter.js';
import { LoginRateLimiter } from './rate-limit/login-rate-limiter.js';
import { SessionRevocationRef } from './session-hooks.js';

/**
 * Instancia de Better Auth (token `AUTH`); `configureApp` la monta en `/api/auth/*`.
 * Los limitadores son proveedores para que los tests puedan reiniciarlos.
 */
@Global()
@Module({
  providers: [
    SecurityEventService,
    { provide: LoginRateLimiter, useFactory: () => new LoginRateLimiter() },
    { provide: AuthRequestLimiter, useFactory: () => new AuthRequestLimiter() },
    { provide: SignupInviteConsumerRef, useFactory: () => new SignupInviteConsumerRef() },
    { provide: SessionRevocationRef, useFactory: () => new SessionRevocationRef() },
    {
      provide: AUTH,
      inject: [
        PrismaService,
        EMAIL_SENDER,
        SecurityEventService,
        LoginRateLimiter,
        AuthRequestLimiter,
        ConfigService,
        SignupInviteConsumerRef,
        SessionRevocationRef,
      ],
      useFactory: (
        prisma: PrismaService,
        emailSender: EmailSender,
        securityEvents: SecurityEventService,
        loginLimiter: LoginRateLimiter,
        requestLimiter: AuthRequestLimiter,
        config: ConfigService,
        inviteConsumer: SignupInviteConsumerRef,
        sessionRevocations: SessionRevocationRef,
      ) =>
        createAuth({
          prisma,
          emailSender,
          securityEvents,
          loginLimiter,
          requestLimiter,
          inviteConsumer,
          sessionRevocations,
          env: {
            NODE_ENV: config.get('NODE_ENV'),
            APP_URL: config.get('APP_URL'),
            API_URL: config.get('API_URL'),
            COOKIE_DOMAIN: config.get('COOKIE_DOMAIN'),
            BETTER_AUTH_SECRET: config.get('BETTER_AUTH_SECRET'),
            SIGNUP_REQUIRES_INVITE: config.get('SIGNUP_REQUIRES_INVITE'),
          },
        }),
    },
  ],
  exports: [AUTH, SecurityEventService, LoginRateLimiter, AuthRequestLimiter, SignupInviteConsumerRef, SessionRevocationRef],
})
export class AuthModule {}
