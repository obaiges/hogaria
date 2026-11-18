import { Link, useLocation } from "react-router";

import { cn } from "@/lib/utils";

import { activeTabId, TAB_ENTRIES, type NavEntry } from "../navigation";

export interface BottomNavProps {
  groupId: string;
  /** Abre la hoja "Más" (HOG-751). Sin ella, el botón queda deshabilitado. */
  onOpenMore?: () => void;
}

const itemClass =
  "flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]";

function TabContent({ entry, active }: { entry: NavEntry; active: boolean }) {
  const Icon = entry.icon;
  return (
    <>
      <span
        className={cn("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-[var(--primary-soft)]")}
        aria-hidden
      >
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <span className={cn(active && "font-semibold")}>{entry.label}</span>
    </>
  );
}

/** Barra inferior de 5 pestañas (spec 15 §7.1, RN-15-02 y RN-15-03). */
export function BottomNav({ groupId, onOpenMore }: BottomNavProps) {
  const { pathname } = useLocation();
  const active = activeTabId(pathname);

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--grout)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex h-[var(--bottomnav-height)] max-w-3xl items-stretch">
        {TAB_ENTRIES.map((entry) => {
          const isActive = active === entry.id;
          const color = isActive ? "text-[var(--primary)]" : "text-[var(--ink-muted)]";
          return (
            <li key={entry.id} className="flex flex-1">
              {entry.to ? (
                <Link
                  to={entry.to(groupId)}
                  viewTransition
                  aria-current={isActive ? "page" : undefined}
                  className={cn(itemClass, color)}
                >
                  <TabContent entry={entry} active={isActive} />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onOpenMore}
                  disabled={!onOpenMore}
                  aria-haspopup="dialog"
                  aria-current={isActive ? "page" : undefined}
                  className={cn(itemClass, color, "disabled:cursor-default")}
                >
                  <TabContent entry={entry} active={isActive} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
