import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { myGroupDto, type CreateGroupInput, type MyGroupDto } from "@hogaria/shared";

import { api } from "@/lib/apiClient";

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
