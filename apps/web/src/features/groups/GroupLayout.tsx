import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Outlet, useParams } from "react-router";

import { isUuid } from "@/app/navigation-utils";
import { NotFoundPage } from "@/app/pages/NotFoundPage";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMe } from "@/features/auth/api";
import { ApiError } from "@/lib/apiClient";

import { groupDetailQuery, groupMembersQuery } from "./api";
import { GroupProvider, type ActiveGroup } from "./GroupProvider";
import { writeLastGroupId } from "./landing";

export const NOT_FOUND_TEXT = {
  title: "No encontrado",
  body: "Este hogar no existe o no formas parte de él.",
  action: "Ir a mis hogares",
} as const;

const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;

/** "No encontrado" (spec 02 §7, E2E-15): `ErrorState` sin "Reintentar" y vuelta a `/grupos`. */
export function GroupNotFound() {
  return <NotFoundPage body={NOT_FOUND_TEXT.body} action={NOT_FOUND_TEXT.action} to="/grupos" />;
}

/**
 * Layout de `/g/:groupId/*` (spec 02, RN-02-31): carga el grupo y sus miembros, expone
 * `useActiveGroup()` y guarda `hogaria:lastGroupId`. Un 404 (no existe o es ajeno) → "No encontrado".
 */
export function GroupLayout() {
  const { groupId = "" } = useParams();
  // Un id mal formado no llega a la API (spec 15 §10).
  const validId = isUuid(groupId);
  const me = useMe();
  const detail = useQuery({ ...groupDetailQuery(groupId), enabled: validId });
  const members = useQuery({ ...groupMembersQuery(groupId), enabled: validId });

  const value = useMemo<ActiveGroup | null>(() => {
    if (!detail.data || !members.data || !me.data) return null;
    const meId = me.data.id;
    const myMember = members.data.find((m) => m.userId === meId);
    if (!myMember) return null;
    return {
      group: detail.data,
      members: members.data,
      me: myMember,
      timezone: detail.data.timezone,
    };
  }, [detail.data, members.data, me.data]);

  const loadedGroupId = value?.group.id;
  useEffect(() => {
    if (loadedGroupId) writeLastGroupId(loadedGroupId);
  }, [loadedGroupId]);

  // Sin miembro propio en la lista (p. ej. expulsado entre peticiones): igual que un 404.
  const notMember = Boolean(detail.data && members.data && me.data && !value);
  if (!validId || isNotFound(detail.error) || isNotFound(members.error) || notMember) return <GroupNotFound />;

  if (detail.isError || members.isError) {
    return (
      <div className="mx-auto max-w-sm px-4 pt-10">
        <ErrorState
          message="No se ha podido cargar el hogar"
          onRetry={() => {
            void detail.refetch();
            void members.refetch();
          }}
        />
      </div>
    );
  }

  if (!value) {
    return (
      <div className="p-4" aria-busy="true" aria-label="Cargando">
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  return (
    <GroupProvider value={value}>
      <Outlet />
    </GroupProvider>
  );
}
