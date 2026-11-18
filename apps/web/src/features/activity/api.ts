import { infiniteQueryOptions, useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";

import { activityDto, paginated, type ActivityDto, type Paginated } from "@hogaria/shared";

import { api } from "@/lib/apiClient";

export type ActivityPages = InfiniteData<Paginated<ActivityDto>, string | null>;

const activityPage = paginated(activityDto);

/** `GET /groups/:g/activity` como *infinite query* `['group', g, 'activity']` (spec 03, RN-03-30). */
export function activityQuery(groupId: string) {
  return infiniteQueryOptions({
    queryKey: ["group", groupId, "activity"] as const,
    queryFn: ({ pageParam }) => {
      const qs = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : "";
      return api.get<Paginated<ActivityDto>>(`/groups/${groupId}/activity${qs}`, { schema: activityPage });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useActivity(groupId: string) {
  return useInfiniteQuery(activityQuery(groupId));
}
