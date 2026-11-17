import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface FormFieldProps {
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
  hint?: string;
}

export function FormField({ label, error, children, className, hint }: FormFieldProps) {
  const autoId = useId();
  const errorId = `${autoId}-error`;
  const hintId = `${autoId}-hint`;
  let control = children;
  const childId = isValidElement(children) ? ((children.props as { id?: string }).id ?? autoId) : autoId;
  if (isValidElement(children)) {
    const child = children as ReactElement<Record<string, unknown>>;
    const describedBy = [hint && !error ? hintId : null, error ? errorId : null, child.props["aria-describedby"] as string | undefined]
      .filter(Boolean)
      .join(" ");
    control = cloneElement(child, {
      id: childId,
      "aria-invalid": error ? true : child.props["aria-invalid"],
      "aria-describedby": describedBy || undefined,
    });
  }
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={childId} className="text-[14px] font-medium text-[var(--ink)]">
        {label}
      </label>
      {control}
      {hint && !error ? <p id={hintId} className="text-[14px] text-[var(--ink-muted)]">{hint}</p> : null}
      {error ? <p id={errorId} className="text-[14px] text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
