import { Button } from "./Button";

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Algo ha fallado. Inténtalo de nuevo", onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-center">
      <p className="text-[16px] text-[var(--danger)]">{message}</p>
      {onRetry ? <Button variant="secondary" onClick={onRetry}>Reintentar</Button> : null}
    </div>
  );
}
