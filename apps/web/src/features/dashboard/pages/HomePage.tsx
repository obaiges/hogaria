import { UserPlus } from "lucide-react";
import { Link } from "react-router";

import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useActiveGroup } from "@/features/groups/GroupProvider";

import { useDashboard } from "../api";
import { Greeting } from "../components/Greeting";
import { RecentActivity } from "../components/RecentActivity";
import { TodayLanes } from "../components/TodayLanes";

export const HOME_TEXT = {
  error: "No hemos podido cargar el inicio",
  inviteTitle: "Invita a tu hogar",
  inviteBody: "Comparte un enlace para que el resto de tu casa vea lo mismo que tú.",
} as const;

function InviteCard({ groupId }: { groupId: string }) {
  return (
    <Link
      to={`/g/${groupId}/ajustes`}
      className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--grout)] bg-[var(--primary-soft)] p-4 text-[var(--on-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <UserPlus className="h-6 w-6 shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="flex flex-col">
        <span className="text-[16px] font-semibold">{HOME_TEXT.inviteTitle}</span>
        <span className="text-[14px]">{HOME_TEXT.inviteBody}</span>
      </span>
    </Link>
  );
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando el inicio">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/**
 * Inicio (`/g/:groupId`, spec 15 §7.2). Fase 1: saludo y fecha, calles (solo nombre y "Nada
 * para hoy"), actividad reciente y, con un único miembro, "Invita a tu hogar". Las secciones de
 * otros módulos se pintarán con `DashboardSection` cuando su clave exista.
 */
export function HomePage() {
  const { group, me, timezone } = useActiveGroup();
  const { date, query } = useDashboard(group.id, timezone);
  const data = query.data;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 pt-6">
      {data ? (
        <>
          <Greeting name={me.name} date={data.date} timezone={timezone} />
          <TodayLanes lanes={data.lanes} members={data.members} />
          {data.members.length === 1 ? <InviteCard groupId={group.id} /> : null}
          <RecentActivity groupId={group.id} items={data.activity} members={data.members} timezone={timezone} />
        </>
      ) : query.isError ? (
        <>
          <Greeting name={me.name} date={date} timezone={timezone} />
          <ErrorState message={HOME_TEXT.error} onRetry={() => void query.refetch()} />
        </>
      ) : (
        <HomeSkeleton />
      )}
    </div>
  );
}
