import { createBrowserRouter, Outlet, redirect, useRouteError, type RouteObject } from "react-router";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { redirectIfAuthenticatedLoader, requireAuthLoader } from "@/features/auth/api";
import { RecoverPasswordPage } from "@/features/auth/pages/RecoverPasswordPage";
import { SignInPage } from "@/features/auth/pages/SignInPage";
import { SignUpPage } from "@/features/auth/pages/SignUpPage";
import { ApiError, NetworkError } from "@/lib/apiClient";

import { DevTokensPage } from "./pages/DevTokensPage";
import { DevUiPage } from "./pages/DevUiPage";

function Page({ title }: { title: string }) {
  return <h1>{title}</h1>;
}

/** Mientras se resuelve la sesión al abrir la app (sin parpadeos de contenido). */
function RouteFallback() {
  return <main className="min-h-screen bg-[var(--bg)]" aria-busy="true" />;
}

/** Error al cargar una ruta (p. ej. la API no responde al comprobar la sesión). */
function RouteError() {
  const error = useRouteError();
  const unreachable = error instanceof NetworkError || (error instanceof ApiError && error.status >= 502 && error.status <= 504);
  const message = unreachable ? "No hay conexión con el servidor. Comprueba tu conexión e inténtalo de nuevo." : "Algo ha fallado. Inténtalo de nuevo";
  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 pt-10">
      <div className="mx-auto flex max-w-sm flex-col gap-4">
        <ErrorState message={message} />
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </div>
    </main>
  );
}

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      { path: "/dev/tokens", element: <DevTokensPage /> },
      { path: "/dev/ui", element: <DevUiPage /> },
    ]
  : [];

/** Rutas sin sesión. `/entrar` y `/registro` mandan a `/` si ya hay sesión (HOG-053). */
const publicRoutes: RouteObject[] = [
  { path: "/entrar", element: <SignInPage />, loader: redirectIfAuthenticatedLoader() },
  { path: "/registro", element: <SignUpPage />, loader: redirectIfAuthenticatedLoader() },
  { path: "/recuperar", element: <RecoverPasswordPage /> },
  { path: "/invite/:token", element: <Page title="Invitación" /> },
  { path: "/legal/privacidad", element: <Page title="Privacidad" /> },
  { path: "/legal/terminos", element: <Page title="Términos" /> },
];

/** Rutas con sesión: el layout privado redirige a `/entrar?volver=…` si no la hay. */
const privateRoutes: RouteObject[] = [
  // La redirección de entrada (último grupo, etc.) es de HOG-104.
  { path: "/", loader: () => redirect("/grupos") },
  { path: "/grupos", element: <Page title="Grupos" /> },
  { path: "/g/:groupId", element: <Page title="Inicio" /> },
  { path: "/g/:groupId/compra", element: <Page title="Compra" /> },
  { path: "/g/:groupId/compra/indispensables", element: <Page title="Indispensables" /> },
  { path: "/g/:groupId/compra/historial", element: <Page title="Historial de compras" /> },
  { path: "/g/:groupId/compra/:listId", element: <Page title="Lista de la compra" /> },
  { path: "/g/:groupId/comidas", element: <Page title="Comidas" /> },
  { path: "/g/:groupId/recetas", element: <Page title="Recetas" /> },
  { path: "/g/:groupId/recetas/nueva", element: <Page title="Nueva receta" /> },
  { path: "/g/:groupId/recetas/:id", element: <Page title="Receta" /> },
  { path: "/g/:groupId/recetas/:id/editar", element: <Page title="Editar receta" /> },
  { path: "/g/:groupId/nevera", element: <Page title="Nevera" /> },
  { path: "/g/:groupId/tareas", element: <Page title="Tareas" /> },
  { path: "/g/:groupId/calendario", element: <Page title="Calendario" /> },
  { path: "/g/:groupId/horarios", element: <Page title="Horarios" /> },
  { path: "/g/:groupId/gastos", element: <Page title="Gastos" /> },
  { path: "/g/:groupId/facturas", element: <Page title="Facturas" /> },
  { path: "/g/:groupId/asistente", element: <Page title="Asistente" /> },
  { path: "/g/:groupId/actividad", element: <Page title="Actividad" /> },
  { path: "/g/:groupId/ajustes", element: <Page title="Ajustes del grupo" /> },
  { path: "/perfil", element: <Page title="Perfil" /> },
  { path: "/admin", element: <Page title="Administración" /> },
];

export const routes: RouteObject[] = [
  {
    hydrateFallbackElement: <RouteFallback />,
    errorElement: <RouteError />,
    children: [...publicRoutes, { id: "private", loader: requireAuthLoader(), element: <Outlet />, children: privateRoutes }, ...devRoutes],
  },
];

export const router = createBrowserRouter(routes);
