import { type ReactNode } from "react";

import { useRippleClass } from "@/components/pool";
import { useRipple } from "@/lib/realtime/ripple-store";
import { cn } from "@/lib/utils";

/** `<li>` que reproduce la onda cuando otro miembro cambia su entidad (spec 03, RN-03-19). */
export function RippleItem({ rippleKey, className, children }: { rippleKey: string; className?: string; children: ReactNode }) {
  const { active, laneColor } = useRipple(rippleKey);
  const ripple = useRippleClass(active, laneColor);
  return (
    <li className={cn(className, ripple.className)} style={ripple.style} data-ripple={active || undefined}>
      {children}
    </li>
  );
}
