import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { groupHandlers, inviteRippleKey, memberRippleKey } from "./realtime";

import type {
  GroupDto,
  GroupInviteDto,
  GroupMemberDto,
  MyGroupDto,
  RealtimeEventName,
  TypedRealtimeEnvelope,
} from "@hogaria/shared";

const G = "0193a0b2-0000-7000-8000-0000000000a1";
const ANA = "0193a0b2-0000-7000-8000-000000000001";
const LUIS = "0193a0b2-0000-7000-8000-000000000002";

const group: GroupDto = {
  id: G,
  name: "Casa Baiges",
  emoji: "🏡",
  timezone: "Europe/Madrid",
  createdById: ANA,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
};
const myGroup: MyGroupDto = { ...group, memberCount: 1, myLaneColor: "CORAL", joinedAt: "2026-11-01T10:00:00.000Z" };

const member = (n: number, userId: string, name: string, laneColor: GroupMemberDto["laneColor"] = "SEA"): GroupMemberDto => ({
  id: `0193a0b2-0000-7000-8000-0000000000b${n}`,
  groupId: G,
  userId,
  name,
  username: null,
  image: null,
  laneColor,
  joinedAt: "2026-11-01T10:00:00.000Z",
});
const ana = member(1, ANA, "Ana", "CORAL");
const luis = member(2, LUIS, "Luis");

const invite = (n: number, status: GroupInviteDto["status"] = "ACTIVE"): GroupInviteDto => ({
  id: `0193a0b2-0000-7000-8000-0000000000c${n}`,
  groupId: G,
  status,
  createdById: LUIS,
  createdByName: "Luis",
  usedById: null,
  usedByName: null,
  expiresAt: "2026-11-25T10:00:00.000Z",
  usedAt: null,
  revokedAt: status === "REVOKED" ? "2026-11-18T10:00:00.000Z" : null,
  createdAt: "2026-11-18T09:00:00.000Z",
});

function envelope<E extends RealtimeEventName>(event: E, data: unknown): TypedRealtimeEnvelope<E> {
  return { event, groupId: G, actorId: LUIS, clientMutationId: null, at: new Date().toISOString(), data } as TypedRealtimeEnvelope<E>;
}

function setup(seed?: (c: QueryClient) => void) {
  const queryClient = new QueryClient();
  seed?.(queryClient);
  const ctx = { queryClient, meId: ANA, activeGroupId: G, navigate: vi.fn(), markRipple: vi.fn(), endSession: vi.fn() };
  return ctx;
}

const membersKey = ["group", G, "members"];
const invitesKey = ["group", G, "invites"];
const myGroupsKey = ["me", "groups"];

describe("handlers de grupos (HOG-109, spec 02 §6)", () => {
  it("group.updated: sustituye el detalle y actualiza el hogar en ['me','groups']", () => {
    const ctx = setup((c) => {
      c.setQueryData(["group", G, "detail"], group);
      c.setQueryData(myGroupsKey, [myGroup]);
    });
    groupHandlers["group.updated"]!(envelope("group.updated", { ...group, name: "Casa nueva" }), ctx);
    expect(ctx.queryClient.getQueryData<GroupDto>(["group", G, "detail"])?.name).toBe("Casa nueva");
    expect(ctx.queryClient.getQueryData<MyGroupDto[]>(myGroupsKey)?.[0]).toMatchObject({ name: "Casa nueva", memberCount: 1, myLaneColor: "CORAL" });
  });

  it("group.updated sin el detalle en caché no lo crea", () => {
    const ctx = setup();
    groupHandlers["group.updated"]!(envelope("group.updated", group), ctx);
    expect(ctx.queryClient.getQueryData(["group", G, "detail"])).toBeUndefined();
  });

  it("group.member.joined: añade al final, suma 1 y hace la onda; repetido no duplica ni vuelve a sumar", () => {
    const ctx = setup((c) => {
      c.setQueryData(membersKey, [ana]);
      c.setQueryData(myGroupsKey, [myGroup]);
    });
    const handler = groupHandlers["group.member.joined"]!;
    handler(envelope("group.member.joined", luis), ctx);
    handler(envelope("group.member.joined", luis), ctx);

    expect(ctx.queryClient.getQueryData<GroupMemberDto[]>(membersKey)?.map((m) => m.name)).toEqual(["Ana", "Luis"]);
    expect(ctx.queryClient.getQueryData<MyGroupDto[]>(myGroupsKey)?.[0]?.memberCount).toBe(2);
    expect(ctx.markRipple).toHaveBeenCalledWith(memberRippleKey(luis.id));
  });

  it("group.member.joined sin la lista en caché no la crea", () => {
    const ctx = setup();
    groupHandlers["group.member.joined"]!(envelope("group.member.joined", luis), ctx);
    expect(ctx.queryClient.getQueryData(membersKey)).toBeUndefined();
  });

  it("group.member.joined de mí mismo (otro dispositivo): recarga mis hogares", () => {
    const ctx = setup((c) => c.setQueryData(myGroupsKey, []));
    const invalidate = vi.spyOn(ctx.queryClient, "invalidateQueries");
    groupHandlers["group.member.joined"]!(envelope("group.member.joined", ana), ctx);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: myGroupsKey });
  });

  it("group.member.updated: sustituye al miembro, hace la onda y, si soy yo, cambia myLaneColor", () => {
    const ctx = setup((c) => {
      c.setQueryData(membersKey, [ana, luis]);
      c.setQueryData(myGroupsKey, [myGroup]);
    });
    groupHandlers["group.member.updated"]!(envelope("group.member.updated", { ...luis, laneColor: "LEAF" }), ctx);
    expect(ctx.queryClient.getQueryData<GroupMemberDto[]>(membersKey)?.[1]?.laneColor).toBe("LEAF");
    expect(ctx.markRipple).toHaveBeenCalledWith(memberRippleKey(luis.id));
    expect(ctx.queryClient.getQueryData<MyGroupDto[]>(myGroupsKey)?.[0]?.myLaneColor).toBe("CORAL");

    groupHandlers["group.member.updated"]!(envelope("group.member.updated", { ...ana, laneColor: "SUN" }), ctx);
    expect(ctx.queryClient.getQueryData<MyGroupDto[]>(myGroupsKey)?.[0]?.myLaneColor).toBe("SUN");
  });

  it("invite.created / revoked / used: upsert por id, la nueva arriba; onda en creada y revocada", () => {
    const old = invite(1, "USED");
    const ctx = setup((c) => c.setQueryData(invitesKey, [old]));
    const created = invite(2);

    groupHandlers["invite.created"]!(envelope("invite.created", created), ctx);
    expect(ctx.queryClient.getQueryData<GroupInviteDto[]>(invitesKey)?.map((i) => i.id)).toEqual([created.id, old.id]);
    expect(ctx.markRipple).toHaveBeenCalledWith(inviteRippleKey(created.id));

    groupHandlers["invite.revoked"]!(envelope("invite.revoked", { ...created, status: "REVOKED" }), ctx);
    expect(ctx.queryClient.getQueryData<GroupInviteDto[]>(invitesKey)).toHaveLength(2);
    expect(ctx.queryClient.getQueryData<GroupInviteDto[]>(invitesKey)?.[0]?.status).toBe("REVOKED");

    ctx.markRipple.mockClear();
    groupHandlers["invite.used"]!(envelope("invite.used", { ...old, usedByName: "Leo" }), ctx);
    expect(ctx.queryClient.getQueryData<GroupInviteDto[]>(invitesKey)?.[1]?.usedByName).toBe("Leo");
    expect(ctx.markRipple).not.toHaveBeenCalled();
  });

  it("invite.* sin la lista en caché no la crea", () => {
    const ctx = setup();
    groupHandlers["invite.created"]!(envelope("invite.created", invite(3)), ctx);
    expect(ctx.queryClient.getQueryData(invitesKey)).toBeUndefined();
  });

  it("group.member.left de otro repetido resta una sola vez", () => {
    const ctx = setup((c) => {
      c.setQueryData(membersKey, [ana, luis]);
      c.setQueryData(myGroupsKey, [{ ...myGroup, memberCount: 2 }]);
    });
    const handler = groupHandlers["group.member.left"]!;
    handler(envelope("group.member.left", { userId: LUIS }), ctx);
    handler(envelope("group.member.left", { userId: LUIS }), ctx);
    expect(ctx.queryClient.getQueryData<MyGroupDto[]>(myGroupsKey)?.[0]?.memberCount).toBe(1);
  });
});
