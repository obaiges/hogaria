import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  acceptInviteResultDto,
  createdGroupInviteDto,
  groupDto,
  groupInviteDto,
  groupMemberDto,
  myGroupDto,
  publicInviteDto,
  type AcceptInviteResultDto,
  type CreatedGroupInviteDto,
  type CreateGroupInput,
  type GroupDto,
  type GroupInviteDto,
  type GroupMemberDto,
  type LaneColor,
  type MyGroupDto,
  type PublicInviteDto,
  type UpdateGroupInput,
} from "@hogaria/shared";

import { api, ApiError } from "@/lib/apiClient";

import { dropMember, forgetGroup } from "./realtime";

/** Un 404 de grupo es definitivo (no existe o es ajeno, RN-02-31): no se reintenta. */
function retryUnlessNotFound(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status === 404) return false;
  return failureCount < 1;
}

/** `GET /groups/:g` → `['group', g, 'detail']`. */
export function groupDetailQuery(groupId: string) {
  return queryOptions({
    queryKey: ["group", groupId, "detail"] as const,
    queryFn: () => api.get<GroupDto>(`/groups/${groupId}`, { schema: groupDto }),
    retry: retryUnlessNotFound,
  });
}

/** `GET /groups/:g/members` → `['group', g, 'members']`. */
export function groupMembersQuery(groupId: string) {
  return queryOptions({
    queryKey: ["group", groupId, "members"] as const,
    queryFn: () => api.get<GroupMemberDto[]>(`/groups/${groupId}/members`, { schema: groupMemberDto.array() }),
    retry: retryUnlessNotFound,
  });
}

/** `GET /me/groups`: grupos del usuario por `joinedAt` asc (RN-02-05). */
export const myGroupsQuery = queryOptions({
  queryKey: ["me", "groups"] as const,
  queryFn: () => api.get<MyGroupDto[]>("/me/groups", { schema: myGroupDto.array() }),
});

export function useMyGroups() {
  return useQuery(myGroupsQuery);
}

/** `POST /groups`: el nuevo hogar se añade al final de `['me', 'groups']` (es el más reciente). */
export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGroupInput) => api.post<MyGroupDto>("/groups", { body: input, schema: myGroupDto }),
    onSuccess: (group) => {
      queryClient.setQueryData<MyGroupDto[]>(myGroupsQuery.queryKey, (old) =>
        old ? [...old.filter((g) => g.id !== group.id), group] : old,
      );
    },
  });
}

export function useGroup(groupId: string) {
  return useQuery(groupDetailQuery(groupId));
}

export function useMembers(groupId: string) {
  return useQuery(groupMembersQuery(groupId));
}

/**
 * `PATCH /groups/:g` con actualización optimista del detalle y de `['me', 'groups']`
 * (RN-02-03, last-write-wins). Si falla, se restaura lo anterior.
 */
export function useUpdateGroup(groupId: string) {
  const queryClient = useQueryClient();
  const detailKey = groupDetailQuery(groupId).queryKey;
  return useMutation({
    mutationFn: (input: UpdateGroupInput) => api.patch<GroupDto>(`/groups/${groupId}`, { body: input, schema: groupDto }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previousDetail = queryClient.getQueryData<GroupDto>(detailKey);
      const previousMine = queryClient.getQueryData<MyGroupDto[]>(myGroupsQuery.queryKey);
      queryClient.setQueryData<GroupDto>(detailKey, (old) => (old ? { ...old, ...input } : old));
      queryClient.setQueryData<MyGroupDto[]>(myGroupsQuery.queryKey, (old) =>
        old?.map((g) => (g.id === groupId ? { ...g, ...input } : g)),
      );
      return { previousDetail, previousMine };
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      queryClient.setQueryData(detailKey, context.previousDetail);
      queryClient.setQueryData(myGroupsQuery.queryKey, context.previousMine);
    },
    onSuccess: (group) => {
      queryClient.setQueryData(detailKey, group);
      queryClient.setQueryData<MyGroupDto[]>(myGroupsQuery.queryKey, (old) =>
        old?.map((g) => (g.id === groupId ? { ...g, ...group } : g)),
      );
    },
  });
}

/**
 * `PATCH /groups/:g/members/me` (RN-02-09): solo el propio color. Optimista sobre
 * `['group', g, 'members']` y `myLaneColor`; con `409` (otro lo cogió antes) se deshace.
 */
export function useUpdateMyLaneColor(groupId: string, myUserId: string) {
  const queryClient = useQueryClient();
  const membersKey = groupMembersQuery(groupId).queryKey;
  return useMutation({
    mutationFn: (laneColor: LaneColor) =>
      api.patch<GroupMemberDto>(`/groups/${groupId}/members/me`, { body: { laneColor }, schema: groupMemberDto }),
    onMutate: async (laneColor) => {
      await queryClient.cancelQueries({ queryKey: membersKey });
      const previousMembers = queryClient.getQueryData<GroupMemberDto[]>(membersKey);
      const previousMine = queryClient.getQueryData<MyGroupDto[]>(myGroupsQuery.queryKey);
      queryClient.setQueryData<GroupMemberDto[]>(membersKey, (old) =>
        old?.map((m) => (m.userId === myUserId ? { ...m, laneColor } : m)),
      );
      queryClient.setQueryData<MyGroupDto[]>(myGroupsQuery.queryKey, (old) =>
        old?.map((g) => (g.id === groupId ? { ...g, myLaneColor: laneColor } : g)),
      );
      return { previousMembers, previousMine };
    },
    onError: (_error, _color, context) => {
      if (!context) return;
      queryClient.setQueryData(membersKey, context.previousMembers);
      queryClient.setQueryData(myGroupsQuery.queryKey, context.previousMine);
    },
    onSuccess: (member) => {
      queryClient.setQueryData<GroupMemberDto[]>(membersKey, (old) => old?.map((m) => (m.id === member.id ? member : m)));
    },
  });
}

/** `GET /groups/:g/invites` → `['group', g, 'invites']`: activas + no activas de los últimos 30 días (RN-02-14). */
export function groupInvitesQuery(groupId: string) {
  return queryOptions({
    queryKey: ["group", groupId, "invites"] as const,
    queryFn: () => api.get<GroupInviteDto[]>(`/groups/${groupId}/invites`, { schema: groupInviteDto.array() }),
  });
}

export function useInvites(groupId: string) {
  return useQuery(groupInvitesQuery(groupId));
}

/** `POST /groups/:g/invites`: el token en claro solo viene en esta respuesta (RN-02-11). */
export function useCreateInvite(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<CreatedGroupInviteDto>(`/groups/${groupId}/invites`, { schema: createdGroupInviteDto }),
    onSuccess: ({ invite }) => {
      queryClient.setQueryData<GroupInviteDto[]>(groupInvitesQuery(groupId).queryKey, (old) =>
        old ? [invite, ...old.filter((i) => i.id !== invite.id)] : old,
      );
    },
  });
}

/** `DELETE /groups/:g/invites/:id`: devuelve la invitación revocada, que sustituye a la de la caché. */
export function useRevokeInvite(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      api.delete<GroupInviteDto>(`/groups/${groupId}/invites/${inviteId}`, { schema: groupInviteDto }),
    onSuccess: (invite) => {
      queryClient.setQueryData<GroupInviteDto[]>(groupInvitesQuery(groupId).queryKey, (old) =>
        old?.map((i) => (i.id === invite.id ? invite : i)),
      );
    },
  });
}

/** Un `410` (no válida, usada, revocada o caducada) es definitivo: no se reintenta. */
function retryUnlessGone(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && (error.status === 410 || error.status === 404)) return false;
  return failureCount < 1;
}

/**
 * `GET /invites/:token` (público, RN-02-16). Con cookies: si hay sesión dice `alreadyMember`
 * y, sin sesión, la API deja la cookie `hogaria_invite` para el registro (HOG-052).
 */
export function publicInviteQuery(token: string) {
  return queryOptions({
    queryKey: ["invite", token] as const,
    queryFn: () => api.get<PublicInviteDto>(`/invites/${token}`, { schema: publicInviteDto, redirectOn401: false }),
    retry: retryUnlessGone,
    staleTime: 0,
  });
}

export function usePublicInvite(token: string) {
  return useQuery(publicInviteQuery(token));
}

/** `POST /invites/:token/accept` (RN-02-17). Al unirse, `['me', 'groups']` se invalida. */
export function useAcceptInvite(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<AcceptInviteResultDto>(`/invites/${token}/accept`, { schema: acceptInviteResultDto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myGroupsQuery.queryKey }),
  });
}

/** `POST /groups/:g/leave` (RN-02-20, RN-02-21). Al terminar, el hogar desaparece de la caché. */
export function useLeaveGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>(`/groups/${groupId}/leave`),
    onSuccess: () => forgetGroup(queryClient, groupId),
  });
}

/** `DELETE /groups/:g/members/:userId` (RN-02-23): expulsar a otro miembro. */
export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete<void>(`/groups/${groupId}/members/${userId}`),
    onSuccess: (_result, userId) => dropMember(queryClient, groupId, userId),
  });
}
