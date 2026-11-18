import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { meQuery } from "@/features/auth/api";

import { BottomNav } from "./BottomNav";
import { MORE_TITLE } from "./MoreSheet";

const G = "0193a0b2-0000-7000-8000-0000000000a1";

const me = (isPlatformAdmin: boolean) => ({
  id: "0193a0b2-0000-7000-8000-000000000001",
  name: "Ana",
  email: "ana@demo.local",
  emailVerified: true,
  username: "ana",
  displayUsername: "ana",
  image: null,
  isPlatformAdmin,
  aiNoticeAcceptedAt: null,
  hasPassword: true,
  hasGoogle: false,
  createdAt: "2026-11-01T10:00:00.000Z",
});

function renderNav(isPlatformAdmin = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  queryClient.setQueryData(meQuery.queryKey, me(isPlatformAdmin));
  const router = createMemoryRouter([{ path: "*", element: <BottomNav groupId={G} /> }], { initialEntries: [`/g/${G}/compra`] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const moreButton = () => screen.getByRole("button", { name: /Más/ });

describe("MoreSheet (HOG-751, RN-15-04)", () => {
  it("muestra solo las entradas habilitadas, agrupadas por sección", async () => {
    renderNav();
    await userEvent.click(moreButton());
    const sheet = await screen.findByRole("dialog", { name: MORE_TITLE });

    expect(within(sheet).getByRole("heading", { name: "Tú" })).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: "Perfil" })).toHaveAttribute("href", "/perfil");
    // Módulos aún sin pantalla (enabled: false): no se enlazan.
    expect(within(sheet).queryByRole("link", { name: "Calendario" })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole("heading", { name: "Organización" })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole("link", { name: "Administración" })).not.toBeInTheDocument();
  });

  it("el botón atrás cierra la hoja sin salir de la pantalla", async () => {
    const router = renderNav();
    await userEvent.click(moreButton());
    await screen.findByRole("dialog", { name: MORE_TITLE });

    await act(() => router.navigate(-1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe(`/g/${G}/compra`);
  });

  it("Esc cierra la hoja y devuelve el foco a la pestaña 'Más'", async () => {
    const router = renderNav();
    await userEvent.click(moreButton());
    await screen.findByRole("dialog", { name: MORE_TITLE });

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe(`/g/${G}/compra`);
    await waitFor(() => expect(moreButton()).toHaveFocus());
  });

  it("elegir una entrada navega y cierra la hoja; atrás vuelve a la pantalla de antes", async () => {
    const router = renderNav();
    await userEvent.click(moreButton());
    const sheet = await screen.findByRole("dialog", { name: MORE_TITLE });

    await userEvent.click(within(sheet).getByRole("link", { name: "Perfil" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/perfil"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe(`/g/${G}/compra`);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
