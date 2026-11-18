import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  groupDto,
  groupMemberDto,
  myGroupDto,
  type CreateGroupInput,
  type GroupDto,
  type GroupMemberDto,
  type MyGroupDto,
} from "@hogaria/shared";

import { api, ApiError } from "@/lib/apiClient";

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
