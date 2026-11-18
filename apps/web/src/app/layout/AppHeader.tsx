import { Link } from "react-router";

import { MemberAvatar } from "@/components/pool";

import { GroupSwitcher } from "./GroupSwitcher";

import type { MeDto, MyGroupDto } from "@hogaria/shared";

export interface AppHeaderProps {
  me: MeDto;
  groups: readonly MyGroupDto[];
  /** Hogar actual; `null` sin hogar (grupo ajeno, sin hogares): solo la marca. */
  current: MyGroupDto | null;
}

/** Cabecera de agua (spec 15 §7.1, DESIGN.md `AppHeader`): selector de hogar y avatar → `/perfil`. */
export function AppHeader({ me, groups, current }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-[var(--shell)] pt-[env(safe-area-inset-top)] text-[var(--on-shell)]">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
        {current ? (
          <GroupSwitcher groups={groups} current={current} />
        ) : (
          <Link to="/" className="font-sign text-[20px] font-semibold uppercase tracking-[0.04em]">
            Hogaria
          </Link>
        )}
        <Link
          to="/perfil"
          aria-label="Tu perfil"
          className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <MemberAvatar member={{ name: me.name, image: me.image, laneColor: current?.myLaneColor ?? null }} size={36} decorative />
        </Link>
      </div>
    </header>
  );
}
