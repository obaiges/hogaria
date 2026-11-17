import { createBrowserRouter } from "react-router";

import { DevTokensPage } from "./pages/DevTokensPage";
import { DevUiPage } from "./pages/DevUiPage";

function Page({ title }: { title: string }) {
  return <h1>{title}</h1>;
}

const devRoutes = import.meta.env.DEV
  ? [
      { path: "/dev/tokens", element: <DevTokensPage /> },
      { path: "/dev/ui", element: <DevUiPage /> },
    ]
  : [];

export const router = createBrowserRouter([
  { path: "/entrar", element: <Page title="Entrar" /> },
  { path: "/registro", element: <Page title="Registro" /> },
  { path: "/recuperar", element: <Page title="Recuperar contraseña" /> },
  { path: "/invite/:token", element: <Page title="Invitación" /> },
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
  { path: "/legal/privacidad", element: <Page title="Privacidad" /> },
  { path: "/legal/terminos", element: <Page title="Términos" /> },
  ...devRoutes,
]);
