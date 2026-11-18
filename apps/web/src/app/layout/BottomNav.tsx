import { useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { cn } from "@/lib/utils";

import { activeTabId, TAB_ENTRIES, type NavEntry } from "../navigation";
import { MoreSheet } from "./MoreSheet";

export interface BottomNavProps {
  groupId: string;
}

/** Estado de historial de la hoja "Más": el botón atrás del sistema la cierra (spec 15 §7.1). */
export const MORE_SHEET_STATE = "more";

function isMoreOpen(state: unknown): boolean {
  return typeof state === "object" && state !== null && (state as { sheet?: unknown }).sheet === MORE_SHEET_STATE;
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
export function BottomNav({ groupId }: BottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const moreRef = useRef<HTMLButtonElement>(null);
  const active = activeTabId(location.pathname);
  const moreOpen = isMoreOpen(location.state);

  // Abrir añade una entrada de historial en la misma URL; cerrar (Esc, X, fondo) la quita.
  const openMore = () => void navigate(location, { state: { sheet: MORE_SHEET_STATE } });
  const closeMore = () => void navigate(-1);

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
                  ref={moreRef}
                  onClick={openMore}
                  aria-haspopup="dialog"
                  aria-expanded={moreOpen}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(itemClass, color)}
                >
                  <TabContent entry={entry} active={isActive} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <MoreSheet groupId={groupId} open={moreOpen} onClose={closeMore} returnFocusTo={moreRef} />
    </nav>
  );
}
