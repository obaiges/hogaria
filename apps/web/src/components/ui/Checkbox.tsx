import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { OFFLINE_TITLE, useCanEdit } from "@/lib/realtime/connection-store";
import { cn } from "@/lib/utils";

export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
    /** Muta datos: se deshabilita sin conexión (RN-03-23). */
    requiresConnection?: boolean;
  }
>(function Checkbox({ className, requiresConnection, disabled, title, ...props }, ref) {
  const canEdit = useCanEdit();
  const blocked = Boolean(requiresConnection) && !canEdit;
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--grout-strong)] bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50 data-[state=checked]:border-[var(--primary)] data-[state=checked]:bg-[var(--primary)] data-[state=checked]:text-white",
        className,
      )}
      disabled={disabled || blocked}
      aria-disabled={blocked || undefined}
      title={blocked ? OFFLINE_TITLE : title}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="h-4 w-4" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
