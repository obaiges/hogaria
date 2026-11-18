import { useRouteError } from "react-router";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { ApiError, NetworkError } from "@/lib/apiClient";

/**
 * Error al cargar una ruta (spec 15 §7.1): chunk antiguo tras un despliegue, excepción o API
 * caída al comprobar la sesión. "Recargar" hace una recarga completa.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const unreachable = error instanceof NetworkError || (error instanceof ApiError && error.status >= 502 && error.status <= 504);
  const message = unreachable ? "No hay conexión con el servidor. Comprueba tu conexión e inténtalo de nuevo." : "Algo ha fallado";
  return (
    <main id="contenido" className="min-h-screen bg-[var(--bg)] px-4 pt-10">
      <div className="mx-auto flex max-w-sm flex-col gap-4">
        <ErrorState message={message} />
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Recargar
        </Button>
      </div>
    </main>
  );
}
