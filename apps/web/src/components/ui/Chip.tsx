import { type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface ChipProps extends HTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function Chip({ className, active, type = "button", ...props }: ChipProps & { type?: "button" | "submit" | "reset" }) {
  return (
    <button
      type={type}
      className={cn(
        "relative inline-flex h-8 items-center after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] rounded-[var(--radius-xs)] border px-3 text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
        active
          ? "border-transparent bg-[var(--primary-soft)] text-[var(--on-primary-soft)]"
          : "border-[var(--grout)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-sunken)]",
        className,
      )}
      aria-pressed={active}
      {...props}
    />
  );
}
