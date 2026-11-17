import { ChevronRight } from "lucide-react";
import { type CSSProperties, type ReactNode } from "react";

import { type LaneColor } from "@hogaria/shared";

import { cn } from "@/lib/utils";

import { laneColorVar, NEUTRAL_LANE_VAR } from "./lane-colors";
import { useRippleClass } from "./useRippleClass";

export interface LaneMember {
  name: string;
  /** `null` = calle neutra (por ejemplo, "Comida" en Inicio o un ex-miembro). */
  laneColor: LaneColor | null;
}

export interface LaneProps {
  member: LaneMember;
  children?: ReactNode;
  onPress?: () => void;
  highlight?: "ripple";
  /** Color de calle del autor del cambio para la onda; por defecto, el de la calle. */
  rippleColor?: LaneColor | null;
  className?: string;
}

/** Calle (DESIGN.md §7): fila por miembro con su color en el borde izquierdo. */
export function Lane({ member, children, onPress, highlight, rippleColor, className }: LaneProps) {
  const ripple = useRippleClass(highlight === "ripple", rippleColor ?? member.laneColor);
  const style = {
    "--lane-c": member.laneColor ? laneColorVar(member.laneColor) : NEUTRAL_LANE_VAR,
    ...ripple.style,
  } as CSSProperties;

  return (
    <div
      role="group"
      aria-label={`Calle de ${member.name}`}
      data-neutral={member.laneColor ? undefined : true}
      className={cn(
        "pool-lane flex min-h-[var(--lane-height)] items-start gap-2.5 rounded-r-[var(--radius-sm)] py-2 pl-3 pr-3",
        onPress && "cursor-pointer",
        ripple.className,
        className,
      )}
      style={style}
      onClick={onPress}
    >
      <div className="min-w-[58px] max-w-[30%] shrink-0 break-words pt-1 font-sign text-[14px] font-semibold uppercase leading-tight tracking-[0.04em] text-[var(--ink)]">
        {member.name}
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{children}</div>
      {onPress ? (
        <button
          type="button"
          aria-label={`Abrir la calle de ${member.name}`}
          className="-my-1 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
