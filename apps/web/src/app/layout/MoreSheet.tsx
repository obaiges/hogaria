import { Link } from "react-router";

import { Sheet, SheetContent } from "@/components/ui/Sheet";
import { useMe } from "@/features/auth/api";

import { visibleMoreEntries, type NavEntry, type NavSection } from "../navigation";

export const MORE_TITLE = "Más";

export interface MoreSheetProps {
  groupId: string;
  open: boolean;
  /** Cierre con Esc, la X o el fondo (el botón atrás del sistema lo gestiona `BottomNav`). */
  onClose: () => void;
  /** Al cerrar, el foco vuelve a la pestaña "Más". */
  returnFocusTo: React.RefObject<HTMLElement | null>;
}

/** Agrupa conservando el orden del registro (RN-15-04). */
function groupBySection(entries: NavEntry[]): [NavSection, NavEntry[]][] {
  const sections = new Map<NavSection, NavEntry[]>();
  for (const entry of entries) {
    if (!entry.section) continue;
    sections.set(entry.section, [...(sections.get(entry.section) ?? []), entry]);
  }
  return [...sections.entries()];
}

/** Hoja "Más" (spec 15 §7.1, RN-15-04): solo entradas habilitadas y "Administración" solo para administradores. */
export function MoreSheet({ groupId, open, onClose, returnFocusTo }: MoreSheetProps) {
  const me = useMe();
  const sections = groupBySection(visibleMoreEntries(me.data?.isPlatformAdmin ?? false));

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent
        title={MORE_TITLE}
        className="max-h-[85vh] overflow-y-auto pb-[calc(16px+env(safe-area-inset-bottom))]"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.current?.focus();
        }}
      >
        <div className="flex flex-col gap-4">
          {sections.map(([section, entries]) => (
            <section key={section} aria-labelledby={`mas-${section}`}>
              <h2
                id={`mas-${section}`}
                className="mb-1 font-sign text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]"
              >
                {section}
              </h2>
              <ul>
                {entries.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <li key={entry.id}>
                      <Link
                        to={entry.to?.(groupId) ?? "/"}
                        replace
                        viewTransition
                        className="flex min-h-[48px] items-center gap-3 rounded-[var(--radius-sm)] px-2 text-[16px] text-[var(--ink)] hover:bg-[var(--surface-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      >
                        <Icon className="h-5 w-5 text-[var(--ink-muted)]" strokeWidth={1.75} aria-hidden />
                        {entry.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
