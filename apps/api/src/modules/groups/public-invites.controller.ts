import { Controller, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { acceptInviteResultDto, publicInviteDto, type AcceptInviteResultDto, type PublicInviteDto } from '@hogaria/shared';

import { CurrentUser, Public } from '../../common/auth/decorators.js';
import { RateLimit } from '../../common/security/rate-limit.js';
import { ApiContract } from '../../openapi/api-contract.decorator.js';
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE_MS } from './invite-token.js';
import { InvitesService } from './invites.service.js';

import type { AuthUser } from '../../common/auth/auth-user.js';
import type { Request, Response } from 'express';

/** Consulta pública y aceptación por enlace (`/invites/:token`). El token nunca va a los logs. */
@Controller('invites')
export class PublicInvitesController {
  constructor(
    private readonly invites: InvitesService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Público, 30 por minuto por IP (RN-02-16). Con una invitación activa y sin sesión pone
   * la cookie `hogaria_invite` que usa el registro (spec 01, RN-01-02).
   */
  @ApiContract({ summary: 'Consultar una invitación (público)', response: publicInviteDto })
  @Public()
  @RateLimit(30, 60_000)
  @Get(':token')
  async get(@Param('token') token: string, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<PublicInviteDto> {
    const { dto, setCookie } = await this.invites.getPublic(token, req.headers);
    if (setCookie) {
      const domain = this.config.get<string>('COOKIE_DOMAIN')?.trim();
      res.cookie(INVITE_COOKIE, token, {
        httpOnly: true,
        secure: this.config.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: INVITE_COOKIE_MAX_AGE_MS,
        ...(domain ? { domain } : {}),
      });
    }
    return dto;
  }

  @ApiContract({ summary: 'Aceptar una invitación con sesión', response: acceptInviteResultDto })
  @HttpCode(200)
  @Post(':token/accept')
  accept(@Param('token') token: string, @CurrentUser() user: AuthUser): Promise<AcceptInviteResultDto> {
    return this.invites.accept(token, user.id);
  }
}
