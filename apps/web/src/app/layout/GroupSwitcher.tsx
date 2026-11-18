import { Check, ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/Sheet";
import { cn } from "@/lib/utils";

import { switchGroupPath } from "../navigation-utils";

import type { MyGroupDto } from "@hogaria/shared";

export const SWITCHER_TEXT = {
  sheetTitle: "Tus hogares",
  createOrJoin: "Crear o unirme a un hogar",
  label: (name: string) => `Cambiar de hogar, actual: ${name}`,
} as const;

export interface GroupSwitcherProps {
  groups: readonly MyGroupDto[];
  current: MyGroupDto;
}

/**
 * Selector de hogar de la cabecera (spec 15 §7.1, RN-15-10 y RN-15-11): emoji + nombre y
 * chevron solo con 2 o más hogares. La hoja "Tus hogares" lleva a la misma sección del otro hogar.
 */
export function GroupSwitcher({ groups, current }: GroupSwitcherProps) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const several = groups.length >= 2;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="-ml-2 flex min-h-[44px] min-w-0 items-center gap-2 rounded-[var(--radius-sm)] px-2 text-[var(--on-shell)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        aria-label={SWITCHER_TEXT.label(current.name)}
      >
        <span className="text-[20px] leading-none" aria-hidden>
          {current.emoji}
        </span>
        <span className="truncate text-[18px] font-semibold">{current.name}</span>
        {several ? <ChevronDown className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden data-testid="switcher-chevron" /> : null}
      </SheetTrigger>
      <SheetContent title={SWITCHER_TEXT.sheetTitle} className="pb-[calc(16px+env(safe-area-inset-bottom))]">
        <ul className="flex flex-col">
          {groups.map((group) => {
            const isCurrent = group.id === current.id;
            return (
              <li key={group.id}>
                <Link
                  to={switchGroupPath(pathname, group.id)}
                  viewTransition
                  onClick={() => setOpen(false)}
                  aria-current={isCurrent ? "true" : undefined}
                  className={cn(
                    "flex min-h-[48px] items-center gap-3 rounded-[var(--radius-sm)] px-2 text-[16px] text-[var(--ink)] hover:bg-[var(--surface-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                    isCurrent && "bg-[var(--primary-soft)] text-[var(--on-primary-soft)]",
                  )}
                >
                  <span className="text-[20px] leading-none" aria-hidden>
                    {group.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                  {isCurrent ? <Check className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-label="Actual" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          to="/grupos"
          onClick={() => setOpen(false)}
          className="mt-2 flex min-h-[48px] items-center gap-3 rounded-[var(--radius-sm)] border-t border-[var(--grout)] px-2 pt-2 text-[16px] font-semibold text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <Plus className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          {SWITCHER_TEXT.createOrJoin}
        </Link>
      </SheetContent>
    </Sheet>
  );
}
