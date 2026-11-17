import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "min-h-[44px] w-full rounded-[var(--radius-sm)] border border-[var(--grout)] bg-[var(--surface-sunken)] px-3 text-[16px] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:border-[var(--focus-ring)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
