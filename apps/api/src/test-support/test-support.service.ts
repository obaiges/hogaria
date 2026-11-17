import { Inject, Injectable } from '@nestjs/common';
import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod';

import { LANE_COLOR_ORDER, type LaneColor } from '@hogaria/shared';

import { AppError } from '../common/errors/app-error.js';
import { EMAIL_SENDER } from '../email/email-sender.js';
import { FakeEmailSender, type SentEmail } from '../email/fake-email-sender.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { truncateAllTables } from './truncate.js';

export const createTestUserInput = z
  .object({
    name: z.string().min(1).default('Usuario e2e'),
    email: z.email().optional(),
    username: z.string().min(3).optional(),
    password: z.string().min(8).default('hogaria-e2e-1234'),
    isPlatformAdmin: z.boolean().default(false),
    /** Crea un hogar nuevo con este usuario como primer miembro. */
    group: z.object({ name: z.string().min(1).default('Casa e2e') }).optional(),
    /** Une al usuario a un hogar existente (siguiente color de calle libre). */
    joinGroupId: z.uuid().optional(),
  })
  .refine((v) => !(v.group && v.joinGroupId), { message: 'Usa group o joinGroupId, no los dos' });

export type CreateTestUserInput = z.infer<typeof createTestUserInput>;

export interface CreatedTestUser {
  userId: string;
  name: string;
  email: string;
  username: string;
  password: string;
  groupId: string | null;
  laneColor: LaneColor | null;
}

let seq = 0;

/** Solo con NODE_ENV=test (ver TestSupportModule). */
@Injectable()
export class TestSupportService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SENDER) private readonly emailSender: unknown,
  ) {}

  async reset(): Promise<void> {
    await truncateAllTables(this.prisma);
    this.fakeEmails().clear();
  }

  emails(to?: string): SentEmail[] {
    const fake = this.fakeEmails();
    return to ? fake.to(to) : [...fake.sent];
  }

  async createUser(input: CreateTestUserInput): Promise<CreatedTestUser> {
    seq += 1;
    const tag = `${Date.now().toString(36)}${seq}`;
    const username = (input.username ?? `e2e_${tag}`).toLowerCase();
    const email = input.email ?? `${username}@e2e.local`;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: input.name, email, username, displayUsername: username, emailVerified: true, isPlatformAdmin: input.isPlatformAdmin },
      });
      // Mismo hash que Better Auth para que el login real funcione (HOG-050).
      await tx.account.create({
        data: { userId: user.id, accountId: user.id, providerId: 'credential', password: await hashPassword(input.password) },
      });

      let groupId: string | null = null;
      let laneColor: LaneColor | null = null;
      if (input.group) {
        const group = await tx.group.create({ data: { name: input.group.name, createdById: user.id } });
        groupId = group.id;
        laneColor = LANE_COLOR_ORDER[0];
      } else if (input.joinGroupId) {
        const group = await tx.group.findUnique({ where: { id: input.joinGroupId }, include: { members: true } });
        if (!group) throw new AppError('NOT_FOUND', 'El hogar no existe');
        groupId = group.id;
        const used = new Set(group.members.map((m) => m.laneColor));
        laneColor = LANE_COLOR_ORDER.find((c) => !used.has(c)) ?? LANE_COLOR_ORDER[group.members.length % LANE_COLOR_ORDER.length]!;
      }
      if (groupId && laneColor) {
        await tx.groupMember.create({ data: { groupId, userId: user.id, laneColor } });
      }

      return { userId: user.id, name: user.name, email, username, password: input.password, groupId, laneColor };
    });
  }

  private fakeEmails(): FakeEmailSender {
    if (!(this.emailSender instanceof FakeEmailSender)) {
      throw new AppError('INTERNAL', 'test-support necesita FakeEmailSender (NODE_ENV=test)');
    }
    return this.emailSender;
  }
}
