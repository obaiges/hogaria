import { useEffect } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMyGroups } from "@/features/groups/api";
import { clearLastGroupId, readLastGroupId, resolveLandingRoute } from "@/features/groups/landing";

/** `/`: redirección de entrada (spec 02, RN-02-30). Sin interfaz propia: un `Skeleton` mientras resuelve. */
export function RootRedirect() {
  const navigate = useNavigate();
  const groups = useMyGroups();

  useEffect(() => {
    if (!groups.data) return;
    const { path, staleLastGroupId } = resolveLandingRoute(groups.data, readLastGroupId());
    if (staleLastGroupId) clearLastGroupId();
    void navigate(path, { replace: true });
  }, [groups.data, navigate]);

  if (groups.isError) {
    return (
      <main className="min-h-screen bg-[var(--bg)] px-4 pt-10">
        <div className="mx-auto flex max-w-sm flex-col gap-4">
          <ErrorState message="No se han podido cargar tus hogares" />
          <Button variant="secondary" onClick={() => void navigate("/grupos", { replace: true })}>
            Ir a tus hogares
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] p-4" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-full min-h-[calc(100vh-2rem)] w-full" />
    </main>
  );
}
