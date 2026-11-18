import { Global, Module } from '@nestjs/common';

import { MembershipCache } from '../cache/membership-cache.js';
import { GroupMemberGuard } from './group-member.guard.js';

/**
 * Global: cualquier módulo puede usar `@GroupScoped()` e inyectar `MembershipCache`
 * para invalidarla (grupos, invitaciones, salir/expulsar).
 */
@Global()
@Module({
  providers: [MembershipCache, GroupMemberGuard],
  exports: [MembershipCache, GroupMemberGuard],
})
export class GroupAccessModule {}
