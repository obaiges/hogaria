import { Fragment } from "react";

import { Lane, LaneRope, MemberDot } from "@/components/pool";
import { useRipple } from "@/lib/realtime/ripple-store";

import { laneRippleKey } from "../realtime";

import type { DashboardMemberDto, LaneDto } from "@hogaria/shared";

export const LANES_TEXT = {
  me: "Tú",
  unassigned: "Sin asignar",
  nothing: "Nada para hoy",
} as const;

/** ¿Tiene la calle algo que enseñar hoy? (las sub-secciones llegan con E07, E08 y E09). */
export function laneHasContent(lane: LaneDto): boolean {
  return Boolean(lane.shift || lane.tasks?.items.length || lane.events?.items.length);
}

function TodayLane({ lane, member }: { lane: LaneDto; member: DashboardMemberDto | undefined }) {
  const ripple = useRipple(lane.userId ? laneRippleKey(lane.userId) : "lane:none");
  const name = lane.userId === null ? LANES_TEXT.unassigned : member?.isMe ? LANES_TEXT.me : (member?.name ?? "");
  return (
    <Lane member={{ name, laneColor: member?.laneColor ?? null }} highlight={ripple.active ? "ripple" : undefined} rippleColor={ripple.laneColor}>
      {member ? <MemberDot member={member} decorative className="mt-0.5" /> : null}
      {/* Fase 1: aún no hay turnos, tareas ni eventos (HOG-763/764 pintarán aquí sus filas). */}
      {laneHasContent(lane) ? null : <span className="pt-0.5 text-[14px] text-[var(--ink-muted)]">{LANES_TEXT.nothing}</span>}
    </Lane>
  );
}

/** "Calles de hoy" (spec 15 §7.2): una calle por miembro (tú primero), separadas por corcheras. */
export function TodayLanes({ lanes, members }: { lanes: readonly LaneDto[]; members: readonly DashboardMemberDto[] }) {
  return (
    <section aria-label="Calles de hoy" className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--grout)] bg-[var(--surface)]">
      {lanes.map((lane, i) => (
        <Fragment key={lane.userId ?? "sin-asignar"}>
          {i > 0 ? <LaneRope /> : null}
          <TodayLane lane={lane} member={members.find((m) => m.userId === lane.userId)} />
        </Fragment>
      ))}
    </section>
  );
}
