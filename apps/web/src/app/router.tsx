import { createBrowserRouter, Outlet, ScrollRestoration, type RouteObject } from "react-router";

import { redirectIfAuthenticatedLoader, requireAuthLoader } from "@/features/auth/api";
import { GroupLayout } from "@/features/groups/GroupLayout";

import { AppShell } from "./layout/AppShell";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { UnknownRoutePage } from "./pages/NotFoundPage";
import { RouteErrorPage } from "./pages/RouteErrorPage";
import { RealtimeProvider } from "./providers/RealtimeProvider";
import { RootRedirect } from "./routes/RootRedirect";

/** Mientras se resuelve la sesión al abrir la app (sin parpadeos de contenido). */
function RouteFallback() {
  return <main className="min-h-screen bg-[var(--bg)]" aria-busy="true" />;
}

/** Sección sin implementar dentro del shell (RN-15-05). */
function soon(title: string): Pick<RouteObject, "element"> {
  return { element: <ComingSoonPage title={title} /> };
}

/** Página pública aún sin implementar, fuera del shell. */
function soonPublic(title: string): Pick<RouteObject, "element"> {
  return {
    element: (
      <main id="contenido" className="min-h-screen bg-[var(--bg)]">
        <ComingSoonPage title={title} />
      </main>
    ),
  };
}

// RN-15-18: cada pantalla de feature en su propio chunk; el shell, el router y los providers van en el principal.
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      { path: "/dev/tokens", lazy: () => import("./pages/DevTokensPage").then((m) => ({ Component: m.DevTokensPage })) },
      { path: "/dev/ui", lazy: () => import("./pages/DevUiPage").then((m) => ({ Component: m.DevUiPage })) },
    ]
  : [];

/** Rutas sin sesión, fuera del shell (RN-15-01). `/entrar` y `/registro` mandan a `/` si ya hay sesión (HOG-053). */
const publicRoutes: RouteObject[] = [
  {
    path: "/entrar",
    loader: redirectIfAuthenticatedLoader(),
    lazy: () => import("@/features/auth/pages/SignInPage").then((m) => ({ Component: m.SignInPage })),
  },
  {
    path: "/registro",
    loader: redirectIfAuthenticatedLoader(),
    lazy: () => import("@/features/auth/pages/SignUpPage").then((m) => ({ Component: m.SignUpPage })),
  },
  {
    path: "/recuperar",
    lazy: () => import("@/features/auth/pages/RecoverPasswordPage").then((m) => ({ Component: m.RecoverPasswordPage })),
  },
  { path: "/invite/:token", ...soonPublic("Invitación") },
  { path: "/legal/privacidad", ...soonPublic("Privacidad") },
  { path: "/legal/terminos", ...soonPublic("Términos") },
];

/** Rutas del hogar: `GroupLayout` carga grupo y miembros y pinta "No encontrado" (HOG-107, RN-15-08). */
const groupRoutes: RouteObject = {
  path: "/g/:groupId",
  element: <GroupLayout />,
  children: [
    { index: true, ...soon("Inicio") },
    { path: "/g/:groupId/compra", ...soon("Compra") },
    { path: "/g/:groupId/compra/indispensables", ...soon("Indispensables") },
    { path: "/g/:groupId/compra/historial", ...soon("Historial de compras") },
    { path: "/g/:groupId/compra/:listId", ...soon("Lista de la compra") },
    { path: "/g/:groupId/comidas", ...soon("Comidas") },
    { path: "/g/:groupId/recetas", ...soon("Recetas") },
    { path: "/g/:groupId/recetas/nueva", ...soon("Nueva receta") },
    { path: "/g/:groupId/recetas/:id", ...soon("Receta") },
    { path: "/g/:groupId/recetas/:id/editar", ...soon("Editar receta") },
    { path: "/g/:groupId/nevera", ...soon("¿Qué cocino?") },
    { path: "/g/:groupId/tareas", ...soon("Tareas") },
    { path: "/g/:groupId/calendario", ...soon("Calendario") },
    { path: "/g/:groupId/horarios", ...soon("Horarios") },
    { path: "/g/:groupId/gastos", ...soon("Gastos") },
    { path: "/g/:groupId/facturas", ...soon("Facturas") },
    { path: "/g/:groupId/asistente", ...soon("Asistente") },
    { path: "/g/:groupId/actividad", ...soon("Actividad") },
    {
      path: "/g/:groupId/ajustes",
      lazy: () => import("@/features/groups/pages/GroupSettingsPage").then((m) => ({ Component: m.GroupSettingsPage })),
    },
  ],
};

/** Rutas con sesión: el layout privado redirige a `/entrar?volver=…` si no la hay (RN-15-09). */
const privateRoutes: RouteObject[] = [
  // Redirección de entrada (RN-02-30).
  { path: "/", element: <RootRedirect /> },
  { path: "/grupos", lazy: () => import("@/features/groups/pages/GroupsPage").then((m) => ({ Component: m.GroupsPage })) },
  // Dentro del shell (RN-15-01): el hogar, `/perfil` y `/admin` (RN-15-12).
  {
    element: <AppShell />,
    children: [
      groupRoutes,
      { path: "/perfil", lazy: () => import("@/features/auth/pages/ProfilePage").then((m) => ({ Component: m.ProfilePage })) },
      { path: "/admin", ...soon("Administración") },
    ],
  },
];

export const routes: RouteObject[] = [
  {
    hydrateFallbackElement: <RouteFallback />,
    errorElement: <RouteErrorPage />,
    element: (
      <>
        {/* RN-15-16: al volver atrás se recupera el scroll; al navegar adelante, arriba del todo. */}
        <ScrollRestoration />
        <Outlet />
      </>
    ),
    children: [
      ...publicRoutes,
      {
        id: "private",
        loader: requireAuthLoader(),
        // Socket en tiempo real solo con sesión (HOG-152).
        element: (
          <RealtimeProvider>
            <Outlet />
          </RealtimeProvider>
        ),
        children: privateRoutes,
      },
      ...devRoutes,
      { path: "*", element: <UnknownRoutePage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
