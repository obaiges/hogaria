import { type ReactNode } from "react";

import { Button } from "./Button";

export interface EmptyStateProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export function EmptyState({ title, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--grout)] bg-[var(--surface)] p-6 text-center">
      {icon ? <div className="text-[var(--ink-faint)]">{icon}</div> : null}
      <p className="text-[16px] text-[var(--ink-muted)]">{title}</p>
      {actionLabel && onAction ? (
        <Button variant="primary" onClick={onAction}>{actionLabel}</Button>
      ) : null}
    </div>
  );
}
