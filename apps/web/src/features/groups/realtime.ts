import { useToastStore } from "@/components/ui/Toast";

import { clearLastGroupId, readLastGroupId } from "./landing";

import type { RealtimeHandlers } from "@/lib/realtime/handlers";
import type { GroupMemberDto, MyGroupDto } from "@hogaria/shared";
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

/** Otro miembro ya no está: se quita de la lista y del contador. */
export function dropMember(queryClient: QueryClient, groupId: string, userId: string): void {
  queryClient.setQueryData<GroupMemberDto[]>(["group", groupId, "members"], (old) => old?.filter((m) => m.userId !== userId));
  queryClient.setQueryData<MyGroupDto[]>(MY_GROUPS_KEY, (old) =>
    old?.map((g) => (g.id === groupId ? { ...g, memberCount: Math.max(1, g.memberCount - 1) } : g)),
  );
}

/** Manejadores de grupos (spec 02 §6). El resto de eventos de grupos llegan con HOG-109. */
export const groupHandlers: RealtimeHandlers = {
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
