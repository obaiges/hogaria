import { Injectable } from '@nestjs/common';

import { type MeDto } from '@hogaria/shared';

import { AppError } from '../common/errors/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { accounts: { select: { providerId: true } } },
    });
    if (!user) throw new AppError('UNAUTHENTICATED');
    const providers = new Set(user.accounts.map((a) => a.providerId));
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      username: user.username,
      displayUsername: user.displayUsername,
      image: user.image,
      isPlatformAdmin: user.isPlatformAdmin,
      aiNoticeAcceptedAt: user.aiNoticeAcceptedAt?.toISOString() ?? null,
      hasPassword: providers.has('credential'),
      hasGoogle: providers.has('google'),
      createdAt: user.createdAt.toISOString(),
    };
  }
}
