import { Link } from "react-router";

import { MemberDot, RippleItem } from "@/components/pool";
import { actorLabel, systemSummary, timeLabel } from "@/features/activity/activity-format";
import { activityRippleKey } from "@/features/activity/realtime";

import type { ActivityDto, DashboardMemberDto } from "@hogaria/shared";

export const RECENT_TEXT = {
  title: "Actividad reciente",
  empty: "Todavía no hay actividad. ¡Empezad a usar Hogaria!",
  all: "Ver toda la actividad",
} as const;

/** "Actividad reciente" del Inicio (spec 15 §7.2): las 5 últimas y el enlace al feed. */
export function RecentActivity({
  groupId,
  items,
  members,
  timezone,
}: {
  groupId: string;
  items: readonly ActivityDto[];
  members: readonly DashboardMemberDto[];
  timezone: string;
}) {
  return (
    <section aria-labelledby="inicio-actividad" className="flex flex-col gap-2">
      <h2 id="inicio-actividad" className="font-sign text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]">
        {RECENT_TEXT.title}
      </h2>
      {items.length === 0 ? (
        <p className="text-[16px] text-[var(--ink-muted)]">{RECENT_TEXT.empty}</p>
      ) : (
        <ul className="divide-y divide-[var(--grout)]">
          {items.map((item) => {
            const actor = actorLabel(item);
            const member = item.actorId ? members.find((m) => m.userId === item.actorId) : undefined;
            return (
              <RippleItem key={item.id} rippleKey={activityRippleKey(item.id)} className="flex min-h-[48px] items-center gap-3 py-2">
                <MemberDot member={actor ? { name: actor, laneColor: member?.laneColor ?? null, image: member?.image ?? null } : null} decorative />
                <p className="min-w-0 flex-1 text-[15px] text-[var(--ink)]">
                  {actor ? (
                    <>
                      <strong className="font-semibold">{actor}</strong> {item.summary}
                    </>
                  ) : (
                    systemSummary(item.summary)
                  )}
                </p>
                <time dateTime={item.createdAt} className="shrink-0 text-[13px] tabular-nums text-[var(--ink-muted)]">
                  {timeLabel(item.createdAt, timezone)}
                </time>
              </RippleItem>
            );
          })}
        </ul>
      )}
      <Link
        to={`/g/${groupId}/actividad`}
        className="self-start py-2 text-[15px] font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        {RECENT_TEXT.all}
      </Link>
    </section>
  );
}
