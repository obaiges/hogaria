import { useEffect, useMemo, useRef } from "react";

import { MemberAvatar, RippleItem } from "@/components/pool";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useActiveGroup } from "@/features/groups/GroupProvider";

import { actorLabel, groupByDay, systemSummary, timeLabel } from "../activity-format";
import { useActivity } from "../api";
import { activityRippleKey } from "../realtime";

import type { ActivityDto, GroupMemberDto } from "@hogaria/shared";

export const ACTIVITY_TEXT = {
  title: "Actividad",
  empty: "Todavía no hay actividad. Lo que hagáis en el hogar aparecerá aquí.",
  error: "No se ha podido cargar la actividad",
  loadMore: "Cargar más",
  end: "No hay actividad anterior (se guarda 90 días)",
} as const;

function ActivityRow({ item, members, timezone }: { item: ActivityDto; members: readonly GroupMemberDto[]; timezone: string }) {
  const actor = actorLabel(item);
  // Color de calle del actor si sigue siendo miembro; si no (o es sistema / cuenta borrada), neutro.
  const member = item.actorId ? members.find((m) => m.userId === item.actorId) : undefined;
  return (
    <RippleItem rippleKey={activityRippleKey(item.id)} className="flex min-h-[52px] items-center gap-3 py-2">
      <MemberAvatar
        member={actor ? { name: actor, laneColor: member?.laneColor ?? null, image: member?.image ?? null } : null}
        size={28}
        decorative
      />
      <p className="min-w-0 flex-1 text-[16px] text-[var(--ink)]">
        {actor ? (
          <>
            <strong className="font-semibold">{actor}</strong> {item.summary}
          </>
        ) : (
          systemSummary(item.summary)
        )}
      </p>
      <time dateTime={item.createdAt} className="shrink-0 text-[14px] tabular-nums text-[var(--ink-muted)]">
        {timeLabel(item.createdAt, timezone)}
      </time>
    </RippleItem>
  );
}

/** `/g/:groupId/actividad` (spec 03 §7): feed por días en la zona del hogar, con paginación infinita. */
export function ActivityPage() {
  const { group, members, timezone } = useActiveGroup();
  const activity = useActivity(group.id);
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = activity;

  const items = useMemo(() => activity.data?.pages.flatMap((p) => p.items) ?? [], [activity.data]);
  const days = useMemo(() => groupByDay(items, timezone), [items, timezone]);
  const autoLoad = typeof IntersectionObserver !== "undefined";

  // Al llegar al final se pide la siguiente página; si falla, queda el botón "Cargar más".
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !autoLoad || !hasNextPage || isFetchNextPageError) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [autoLoad, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-6">
      <h1 className="font-sign text-[28px] font-semibold uppercase tracking-[0.04em] text-[var(--ink)]">{ACTIVITY_TEXT.title}</h1>

      {activity.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando actividad">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : activity.isError && items.length === 0 ? (
        <ErrorState message={ACTIVITY_TEXT.error} onRetry={() => void activity.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={ACTIVITY_TEXT.empty} />
      ) : (
        <>
          {days.map((day) => (
            <section key={day.key} aria-labelledby={`dia-${day.key}`}>
              <h2
                id={`dia-${day.key}`}
                className="font-sign text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]"
              >
                {day.label}
              </h2>
              <ul className="divide-y divide-[var(--grout)]">
                {day.items.map((item) => (
                  <ActivityRow key={item.id} item={item} members={members} timezone={timezone} />
                ))}
              </ul>
            </section>
          ))}

          <div ref={sentinel} className="flex flex-col items-center gap-2 pb-4">
            {hasNextPage ? (
              isFetchingNextPage ? (
                <Skeleton className="h-10 w-full" aria-label="Cargando más actividad" />
              ) : isFetchNextPageError || !autoLoad ? (
                <Button variant="secondary" onClick={() => void fetchNextPage()}>
                  {ACTIVITY_TEXT.loadMore}
                </Button>
              ) : null
            ) : (
              <p className="text-center text-[14px] text-[var(--ink-muted)]">{ACTIVITY_TEXT.end}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
