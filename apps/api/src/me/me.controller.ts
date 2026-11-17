import { Controller, Get } from '@nestjs/common';

import { meDto, type MeDto } from '@hogaria/shared';

import { CurrentUser } from '../common/auth/decorators.js';
import { ApiContract } from '../openapi/api-contract.decorator.js';
import { MeService } from './me.service.js';

import type { AuthUser } from '../common/auth/auth-user.js';

@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @ApiContract({ summary: 'Usuario de la sesión', response: meDto })
  @Get()
  get(@CurrentUser() user: AuthUser): Promise<MeDto> {
    return this.me.getMe(user.id);
  }
}
