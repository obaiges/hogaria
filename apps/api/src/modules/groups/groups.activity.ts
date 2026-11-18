import { quoteRename, truncateName } from '../../activity/summary.js';

import type { Group } from '@prisma/client';

/** Campos editables de un grupo (`updateGroupInput`). */
export type GroupField = 'name' | 'emoji' | 'timezone';

/** Textos de actividad de grupos (spec 02 §9). Sin el nombre del actor. */
export const groupActivity = {
  created: (group: Pick<Group, 'name' | 'emoji'>) => `creó el hogar ${group.emoji} ${truncateName(group.name)}`,

  updated: (group: Pick<Group, 'name' | 'emoji' | 'timezone'>, fields: readonly GroupField[]): string => {
    if (fields.length === 1) {
      switch (fields[0]) {
        case 'name':
          return `cambió el nombre del hogar a ${quoteRename(group.name)}`;
        case 'emoji':
          return `cambió el emoji del hogar a ${group.emoji}`;
        case 'timezone':
          return `cambió la zona horaria del hogar a ${group.timezone}`;
      }
    }
    return 'actualizó los datos del hogar';
  },

  memberJoined: () => 'se unió al hogar',
  memberLeft: () => 'salió del hogar',
  memberRemoved: (name: string) => `expulsó a ${truncateName(name)} del hogar`,
  inviteCreated: () => 'creó una invitación',
  inviteRevoked: () => 'revocó una invitación',
};
