import { type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xs)] bg-[var(--grout)] motion-safe:animate-pulse motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
