import { forwardRef, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[88px] w-full rounded-[var(--radius-sm)] border border-[var(--grout)] bg-[var(--surface-sunken)] px-3 py-2 text-[16px] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
