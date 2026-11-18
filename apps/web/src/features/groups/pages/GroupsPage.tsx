import { useState } from "react";
import { Link } from "react-router";

import logoDark from "@/assets/logo-horizontal-dark.svg";
import logo from "@/assets/logo-horizontal.svg";
import { MemberAvatar, MemberDot } from "@/components/pool/MemberAvatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMe } from "@/features/auth/api";
import { useCanEdit } from "@/lib/realtime/connection-store";

import { useMyGroups } from "../api";
import { CreateGroupSheet } from "../components/CreateGroupSheet";

export const GROUPS_TEXT = {
  title: "Tus hogares",
  create: "Crear hogar",
  empty: "Aún no perteneces a ningún hogar.",
  invited: "¿Te han invitado? Abre el enlace que te enviaron.",
  error: "No se han podido cargar tus hogares",
} as const;

const members = (n: number) => (n === 1 ? "1 miembro" : `${n} miembros`);

/** `/grupos` (spec 02 §7): selector de hogares y creación. Sin `BottomNav`. */
export function GroupsPage() {
  const groups = useMyGroups();
  const { data: me } = useMe();
  const canEdit = useCanEdit();
  const [creating, setCreating] = useState(false);

  const openCreate = () => setCreating(true);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="flex h-14 items-center justify-between border-b border-[var(--grout)] bg-[var(--surface)] px-4">
        <span>
          <img src={logo} alt="Hogaria" className="logo-light h-7 w-auto" />
          <img src={logoDark} alt="Hogaria" className="logo-dark h-7 w-auto" />
        </span>
        <Link
          to="/perfil"
          aria-label="Perfil"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <MemberAvatar member={me ? { name: me.name, image: me.image, laneColor: null } : null} fallbackLabel="Perfil" decorative />
        </Link>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-10 pt-6">
        <h1 className="font-sign text-[28px] font-semibold uppercase tracking-[0.04em]">{GROUPS_TEXT.title}</h1>

        {groups.isPending ? (
          <ul aria-busy="true" aria-label={GROUPS_TEXT.title} className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="h-14 w-full" />
              </li>
            ))}
          </ul>
        ) : groups.isError ? (
          <ErrorState message={GROUPS_TEXT.error} onRetry={() => void groups.refetch()} />
        ) : groups.data.length === 0 ? (
          <div className="tile-grid flex flex-col gap-3 rounded-[var(--radius-md)]">
            <EmptyState title={GROUPS_TEXT.empty} actionLabel={canEdit ? GROUPS_TEXT.create : undefined} onAction={openCreate} />
            <p className="text-center text-[14px] text-[var(--ink-muted)]">{GROUPS_TEXT.invited}</p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-[var(--grout)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--grout)] bg-[var(--surface)]">
              {groups.data.map((group) => (
                <li key={group.id}>
                  <Link
                    to={`/g/${group.id}`}
                    className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-[var(--surface-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
                  >
                    <span aria-hidden className="text-[28px] leading-none">
                      {group.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold">{group.name}</span>
                      <span className="block text-[14px] text-[var(--ink-muted)]">{members(group.memberCount)}</span>
                    </span>
                    <MemberDot member={{ name: me?.name ?? "Tú", image: null, laneColor: group.myLaneColor }} decorative />
                  </Link>
                </li>
              ))}
            </ul>
            <Button variant="secondary" requiresConnection className="w-full" onClick={openCreate}>
              {GROUPS_TEXT.create}
            </Button>
          </>
        )}
      </main>

      <CreateGroupSheet open={creating} onOpenChange={setCreating} />
    </div>
  );
}
