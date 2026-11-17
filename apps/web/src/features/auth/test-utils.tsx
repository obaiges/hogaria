import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation, type RouteObject } from "react-router";

import { TEST_API_URL } from "@/test/msw";

/** URL de Better Auth en los tests: `http://api.test/api/auth/<path>`. */
export function authUrl(path: string): string {
  return `${TEST_API_URL}/api/auth${path}`;
}

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

/** Monta una pantalla en un router de memoria; cualquier otra ruta pinta dónde ha acabado. */
export function renderRoute(
  element: React.ReactNode,
  path: string,
  initialEntry: string,
): { router: ReturnType<typeof createMemoryRouter>; queryClient: QueryClient } {
  const routes: RouteObject[] = [
    { path, element },
    { path: "*", element: <Where /> },
  ];
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}
