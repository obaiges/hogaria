import { cn } from "@/lib/utils";

export interface LaneRopeProps {
  /** `limit` (rojo y blanco) marca un límite; su significado siempre va acompañado de texto. */
  variant?: "default" | "limit";
  className?: string;
}

/** Corchera (DESIGN.md §7): separador decorativo entre calles. */
export function LaneRope({ variant = "default", className }: LaneRopeProps) {
  return <div aria-hidden className={cn("pool-rope", className)} data-variant={variant} />;
}
