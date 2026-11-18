import { Construction } from "lucide-react";

export const COMING_SOON_TEXT = "Esta sección llegará pronto";

/** Pantalla de una sección aún sin implementar (RN-15-05). */
export function ComingSoonPage({ title }: { title?: string }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4 pt-16 text-center">
      <Construction className="h-10 w-10 text-[var(--ink-muted)]" strokeWidth={1.75} aria-hidden />
      {title ? (
        <h1 className="font-sign text-[28px] font-semibold uppercase tracking-[0.04em] text-[var(--ink)]">{title}</h1>
      ) : null}
      <p className="text-[16px] text-[var(--ink-muted)]">{COMING_SOON_TEXT}</p>
    </div>
  );
}
