import { Controller, Get, Module } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MembershipCache } from '../src/common/cache/membership-cache.js';
import { CurrentGroup, type GroupContext } from '../src/common/guards/group-context.js';
import { GroupScoped } from '../src/common/guards/group-member.guard.js';
import { uuidv7 } from '../src/common/ids/uuidv7.js';
import { createGroupWithMembers, createUser, loginAs } from './factories/index.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { getTestPrisma } from './utils/prisma.js';

const prisma = getTestPrisma();

@GroupScoped()
@Controller('groups/:groupId/guard-test')
class GroupGuardTestController {
  @Get()
  context(@CurrentGroup() group: GroupContext) {
    return group;
  }
}

@Module({ controllers: [GroupGuardTestController] })
class GroupGuardTestModule {}

const url = (groupId: string) => `/api/v1/groups/${groupId}/guard-test`;

describe('GroupMemberGuard (HOG-101)', () => {
  let t: TestApp;
  let cache: MembershipCache;

  beforeAll(async () => {
    t = await createTestApp({ imports: [GroupGuardTestModule] });
    cache = t.app.get(MembershipCache);
  });

  beforeEach(() => {
    // Cada test trunca la BBDD: la caché del proceso no debe arrastrar resultados.
    cache.clear();
  });

  afterAll(async () => {
    await t.close();
  });

  it('miembro → 200 con groupContext { groupId, timezone, memberId, laneColor }', async () => {
    const { group, users, members } = await createGroupWithMembers(2);
    const agent = await loginAs(users[1]!, t.server);

    const res = await agent.get(url(group.id)).expect(200);
    expect(res.body).toEqual({ groupId: group.id, timezone: 'Europe/Madrid', memberId: members[1]!.id, laneColor: 'SEA' });
  });

  it('sin sesión → 401 (antes que el 404)', async () => {
    const { group } = await createGroupWithMembers(1);
    const res = await request(t.server).get(url(group.id)).expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('otro usuario, grupo inexistente y UUID inválido → 404 con el mismo cuerpo', async () => {
    const { group } = await createGroupWithMembers(1);
    const agent = await loginAs(await createUser(), t.server);

    const foreign = await agent.get(url(group.id)).expect(404);
    const missing = await agent.get(url(uuidv7())).expect(404);
    const invalid = await agent.get(url('no-es-un-uuid')).expect(404);

    expect(foreign.headers['content-type']).toContain('application/problem+json');
    expect(foreign.body).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(missing.body).toEqual(foreign.body);
    expect(invalid.body).toEqual(foreign.body);
  });

  it('cachea: un cambio en BBDD no se ve hasta invalidar; tras invalidate, al instante', async () => {
    const { group, users } = await createGroupWithMembers(1);
    const outsider = await createUser();
    const agent = await loginAs(outsider, t.server);

    await agent.get(url(group.id)).expect(404); // negativo cacheado
    await prisma.groupMember.create({ data: { groupId: group.id, userId: outsider.id, laneColor: 'SEA' } });
    await agent.get(url(group.id)).expect(404);

    cache.invalidate(outsider.id, group.id);
    await agent.get(url(group.id)).expect(200);

    // Salida: positivo cacheado hasta invalidar.
    await prisma.groupMember.deleteMany({ where: { groupId: group.id, userId: outsider.id } });
    await agent.get(url(group.id)).expect(200);
    cache.invalidate(outsider.id, group.id);
    await agent.get(url(group.id)).expect(404);

    // El miembro original no se ve afectado.
    const owner = await loginAs(users[0]!, t.server);
    await owner.get(url(group.id)).expect(200);
  });

  it('invalidateGroup refresca la zona horaria de todos los miembros', async () => {
    const { group, users } = await createGroupWithMembers(2);
    const a = await loginAs(users[0]!, t.server);
    const b = await loginAs(users[1]!, t.server);
    await a.get(url(group.id)).expect(200);
    await b.get(url(group.id)).expect(200);

    await prisma.group.update({ where: { id: group.id }, data: { timezone: 'Atlantic/Canary' } });
    expect((await a.get(url(group.id)).expect(200)).body.timezone).toBe('Europe/Madrid');

    cache.invalidateGroup(group.id);
    expect((await a.get(url(group.id)).expect(200)).body.timezone).toBe('Atlantic/Canary');
    expect((await b.get(url(group.id)).expect(200)).body.timezone).toBe('Atlantic/Canary');
  });
});
