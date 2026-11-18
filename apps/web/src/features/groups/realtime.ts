import { useToastStore } from "@/components/ui/Toast";

import { clearLastGroupId, readLastGroupId } from "./landing";

import type { RealtimeHandlers } from "@/lib/realtime/handlers";
import type { GroupDto, GroupInviteDto, GroupMemberDto, MyGroupDto } from "@hogaria/shared";
import type { QueryClient } from "@tanstack/react-query";

const MY_GROUPS_KEY = ["me", "groups"] as const;

export const NO_LONGER_MEMBER = (groupName: string) => `Ya no formas parte de ${groupName}`;

/**
 * El usuario ya no está en `groupId` (salió, le expulsaron o se borró el hogar, RN-02-32):
 * lo quita de `['me', 'groups']`, olvida `hogaria:lastGroupId` si apuntaba ahí y borra las
 * queries `['group', groupId]`. El borrado va en la siguiente vuelta del bucle para que, si
 * se estaba viendo ese hogar, la navegación lo desmonte antes y no se vuelva a pedir (404).
 */
export function forgetGroup(queryClient: QueryClient, groupId: string): void {
  queryClient.setQueryData<MyGroupDto[]>(MY_GROUPS_KEY, (old) => old?.filter((g) => g.id !== groupId));
  if (readLastGroupId() === groupId) clearLastGroupId();
  setTimeout(() => queryClient.removeQueries({ queryKey: ["group", groupId] }), 0);
}

/** Otro miembro ya no está: se quita de la lista y del contador (una sola vez aunque llegue repetido). */
export function dropMember(queryClient: QueryClient, groupId: string, userId: string): void {
  const membersKey = ["group", groupId, "members"];
  const cached = queryClient.getQueryData<GroupMemberDto[]>(membersKey);
  if (cached && !cached.some((m) => m.userId === userId)) return;
  queryClient.setQueryData<GroupMemberDto[]>(membersKey, (old) => old?.filter((m) => m.userId !== userId));
  queryClient.setQueryData<MyGroupDto[]>(MY_GROUPS_KEY, (old) =>
    old?.map((g) => (g.id === groupId ? { ...g, memberCount: Math.max(1, g.memberCount - 1) } : g)),
  );
}

/** Clave de onda de un miembro o una invitación (`entityType:id`, como en la actividad). */
export const memberRippleKey = (memberId: string) => `group_member:${memberId}`;
export const inviteRippleKey = (inviteId: string) => `group_invite:${inviteId}`;

/** Sustituye o añade por `id`. Si la lista no está en caché, no la crea (RN-03-18). */
function upsertById<T extends { id: string }>(list: T[] | undefined, item: T, position: "start" | "end"): T[] | undefined {
  if (!list) return undefined;
  if (list.some((x) => x.id === item.id)) return list.map((x) => (x.id === item.id ? item : x));
  return position === "start" ? [item, ...list] : [...list, item];
}

function upsertInvite(queryClient: QueryClient, invite: GroupInviteDto): void {
  queryClient.setQueryData<GroupInviteDto[]>(["group", invite.groupId, "invites"], (old) => upsertById(old, invite, "start"));
}

/** Manejadores de grupos, miembros e invitaciones (spec 02 §6, HOG-106 y HOG-109). */
export const groupHandlers: RealtimeHandlers = {
  "group.updated": ({ data: group }, { queryClient }) => {
    queryClient.setQueryData<GroupDto>(["group", group.id, "detail"], (old) => (old ? group : old));
    queryClient.setQueryData<MyGroupDto[]>(MY_GROUPS_KEY, (old) => old?.map((g) => (g.id === group.id ? { ...g, ...group } : g)));
  },

  "group.member.joined": ({ data: member }, { queryClient, meId, markRipple }) => {
    if (member.userId === meId) {
      // Me he unido desde otro dispositivo: la lista de mis hogares cambia entera.
      void queryClient.invalidateQueries({ queryKey: MY_GROUPS_KEY });
      return;
    }
    const membersKey = ["group", member.groupId, "members"];
    const known = queryClient.getQueryData<GroupMemberDto[]>(membersKey)?.some((m) => m.userId === member.userId) ?? false;
    queryClient.setQueryData<GroupMemberDto[]>(membersKey, (old) => upsertById(old, member, "end"));
    if (!known) {
      queryClient.setQueryData<MyGroupDto[]>(MY_GROUPS_KEY, (old) =>
        old?.map((g) => (g.id === member.groupId ? { ...g, memberCount: g.memberCount + 1 } : g)),
      );
    }
    markRipple(memberRippleKey(member.id));
  },

  "group.member.updated": ({ data: member }, { queryClient, meId, markRipple }) => {
    queryClient.setQueryData<GroupMemberDto[]>(["group", member.groupId, "members"], (old) =>
      old?.map((m) => (m.id === member.id ? member : m)),
    );
    if (member.userId === meId) {
      queryClient.setQueryData<MyGroupDto[]>(MY_GROUPS_KEY, (old) =>
        old?.map((g) => (g.id === member.groupId ? { ...g, myLaneColor: member.laneColor } : g)),
      );
    }
    markRipple(memberRippleKey(member.id));
  },

  "invite.created": ({ data: invite }, { queryClient, markRipple }) => {
    upsertInvite(queryClient, invite);
    markRipple(inviteRippleKey(invite.id));
  },

  "invite.revoked": ({ data: invite }, { queryClient, markRipple }) => {
    upsertInvite(queryClient, invite);
    markRipple(inviteRippleKey(invite.id));
  },

  "invite.used": ({ data: invite }, { queryClient }) => {
    upsertInvite(queryClient, invite);
  },

  "group.member.left": (envelope, { queryClient, meId, activeGroupId, navigate }) => {
    const groupId = envelope.groupId;
    if (!groupId) return;
    const { userId } = envelope.data;

    if (userId !== meId) {
      dropMember(queryClient, groupId, userId);
      return;
    }

    // Soy yo: me han expulsado o salí desde otro dispositivo (RN-02-32).
    const name = queryClient.getQueryData<MyGroupDto[]>(MY_GROUPS_KEY)?.find((g) => g.id === groupId)?.name;
    if (activeGroupId === groupId) {
      navigate("/grupos");
      if (name) useToastStore.getState().add({ message: NO_LONGER_MEMBER(name) });
    }
    forgetGroup(queryClient, groupId);
  },
};
