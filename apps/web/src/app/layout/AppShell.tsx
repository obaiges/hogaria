import { Outlet, useMatch } from "react-router";

import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { useMe } from "@/features/auth/api";
import { useMyGroups } from "@/features/groups/api";
import { readLastGroupId } from "@/features/groups/landing";

import { resolveShellGroupId } from "../navigation-utils";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";

/**
 * Shell de las rutas `/g/:groupId/**`, `/perfil` y `/admin` (spec 15 §7.1, RN-15-01):
 * cabecera de agua, contenido y barra inferior. Sin hogar válido (grupo ajeno, sin hogares)
 * no hay barra inferior (RN-15-08, RN-15-12).
 */
export function AppShell() {
  const me = useMe();
  const groups = useMyGroups();
  const groupMatch = useMatch("/g/:groupId/*");

  const myGroups = groups.data ?? [];
  const shellGroupId = groups.data
    ? resolveShellGroupId(
        groupMatch?.params.groupId,
        myGroups.map((g) => g.id),
        readLastGroupId(),
      )
    : null;
  const current = myGroups.find((g) => g.id === shellGroupId) ?? null;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-[var(--radius-sm)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Saltar al contenido
      </a>
      {/* Cabecera y, bajo ella, el único banner de sin conexión del shell (RN-15-17, HOG-752). */}
      <div className="sticky top-0 z-30">
        {me.data ? <AppHeader me={me.data} groups={myGroups} current={current} /> : <div className="h-14 bg-[var(--shell)]" />}
        <OfflineBanner />
      </div>
      <main
        id="contenido"
        tabIndex={-1}
        className={current ? "pb-[calc(var(--bottomnav-height)+env(safe-area-inset-bottom)+16px)]" : "pb-6"}
      >
        <Outlet />
      </main>
      {current ? <BottomNav groupId={current.id} /> : null}
    </div>
  );
}
