import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Outlet, useNavigate, useParams } from "react-router";

import { Button } from "@/components/ui/Button";
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

function Screen({ children, busy = false }: { children: React.ReactNode; busy?: boolean }) {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 pt-10" aria-busy={busy || undefined}>
      <div className="mx-auto flex max-w-sm flex-col gap-4">{children}</div>
    </main>
  );
}

/** "No encontrado" (spec 02 §7, E2E-15): `ErrorState` sin "Reintentar" y vuelta a `/grupos`. */
export function GroupNotFound() {
  const navigate = useNavigate();
  return (
    <Screen>
      <h1 className="text-center font-sign text-[28px] font-semibold uppercase tracking-[0.04em] text-[var(--ink)]">
        {NOT_FOUND_TEXT.title}
      </h1>
      <ErrorState message={NOT_FOUND_TEXT.body} />
      <Button onClick={() => void navigate("/grupos")}>{NOT_FOUND_TEXT.action}</Button>
    </Screen>
  );
}

/**
 * Layout de `/g/:groupId/*` (spec 02, RN-02-31): carga el grupo y sus miembros, expone
 * `useActiveGroup()` y guarda `hogaria:lastGroupId`. Un 404 (no existe o es ajeno) → "No encontrado".
 */
export function GroupLayout() {
  const { groupId = "" } = useParams();
  const me = useMe();
  const detail = useQuery(groupDetailQuery(groupId));
  const members = useQuery(groupMembersQuery(groupId));

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
  if (isNotFound(detail.error) || isNotFound(members.error) || notMember) return <GroupNotFound />;

  if (detail.isError || members.isError) {
    return (
      <Screen>
        <ErrorState
          message="No se ha podido cargar el hogar"
          onRetry={() => {
            void detail.refetch();
            void members.refetch();
          }}
        />
      </Screen>
    );
  }

  if (!value) {
    return (
      <main className="min-h-screen bg-[var(--bg)] p-4" aria-busy="true" aria-label="Cargando">
        <Skeleton className="h-full min-h-[calc(100vh-2rem)] w-full" />
      </main>
    );
  }

  return (
    <GroupProvider value={value}>
      <Outlet />
    </GroupProvider>
  );
}
