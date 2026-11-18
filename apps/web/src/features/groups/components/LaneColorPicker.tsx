import { Check } from "lucide-react";

import { LANE_COLOR_ORDER, type GroupMemberDto, type LaneColor } from "@hogaria/shared";

import { getInitials, Lane, LANE_COLOR_LABEL, laneColorVar } from "@/components/pool";
import { useToast } from "@/components/ui/Toast";
import { ApiError, OfflineError } from "@/lib/apiClient";
import { useCanEdit } from "@/lib/realtime/connection-store";
import { cn } from "@/lib/utils";

import { useUpdateMyLaneColor } from "../api";

export const ALL_COLORS_TAKEN = "Todos los colores están en uso";

export interface LaneColorPickerProps {
  groupId: string;
  me: GroupMemberDto;
  members: readonly GroupMemberDto[];
}

/**
 * "TU COLOR DE CALLE" (spec 02 §7, RN-02-09): 8 muestras de 44 px. Las que tiene otro miembro
 * se deshabilitan con su inicial; pulsar una libre la guarda al momento (optimista, con rollback).
 */
export function LaneColorPicker({ groupId, me, members }: LaneColorPickerProps) {
  const { toast } = useToast();
  const canEdit = useCanEdit();
  const update = useUpdateMyLaneColor(groupId, me.userId);

  const takenBy = new Map<LaneColor, GroupMemberDto>();
  for (const member of members) {
    if (member.userId !== me.userId && !takenBy.has(member.laneColor)) takenBy.set(member.laneColor, member);
  }
  const allTaken = LANE_COLOR_ORDER.every((color) => color === me.laneColor || takenBy.has(color));

  function choose(color: LaneColor) {
    if (color === me.laneColor || update.isPending) return;
    update.mutate(color, {
      onError: (error) => {
        if (error instanceof OfflineError) return; // el apiClient ya ha avisado
        toast(error instanceof ApiError ? (error.detail ?? error.message) : "No se ha podido cambiar el color. Inténtalo de nuevo");
      },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Tu color de calle" className="flex flex-wrap gap-3">
        {LANE_COLOR_ORDER.map((color) => {
          const owner = takenBy.get(color);
          const selected = color === me.laneColor;
          const label = owner ? `${LANE_COLOR_LABEL[color]}, lo tiene ${owner.name}` : LANE_COLOR_LABEL[color];
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              title={label}
              disabled={Boolean(owner) || !canEdit}
              onClick={() => choose(color)}
              style={{ backgroundColor: laneColorVar(color) }}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
                selected && "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--surface)]",
                owner && "opacity-50",
                !owner && !selected && "disabled:opacity-60",
              )}
            >
              {selected ? <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden /> : owner ? <span aria-hidden>{getInitials(owner.name).slice(0, 1)}</span> : null}
            </button>
          );
        })}
      </div>
      {allTaken ? <p className="text-[14px] text-[var(--ink-muted)]">{ALL_COLORS_TAKEN}</p> : null}
      <Lane member={{ name: me.name, laneColor: me.laneColor }}>
        <span className="text-[14px] text-[var(--ink-muted)]">Así se verá tu calle</span>
      </Lane>
    </div>
  );
}
