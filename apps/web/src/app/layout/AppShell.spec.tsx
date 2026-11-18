import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { meQuery } from "@/features/auth/api";
import { myGroupsQuery } from "@/features/groups/api";
import { OFFLINE_MESSAGE, resetConnectionStore, setBrowserOnline } from "@/lib/realtime/connection-store";

import { AppShell } from "./AppShell";
import { SWITCHER_TEXT } from "./GroupSwitcher";

const G = "0193a0b2-0000-7000-8000-0000000000a1";

const me = {
  id: "0193a0b2-0000-7000-8000-000000000001",
  name: "Ana",
  email: "ana@demo.local",
  emailVerified: true,
  username: "ana",
  displayUsername: "ana",
  image: null,
  isPlatformAdmin: false,
  aiNoticeAcceptedAt: null,
  hasPassword: true,
  hasGoogle: false,
  createdAt: "2026-11-01T10:00:00.000Z",
};

const casa = {
  id: G,
  name: "Casa Baiges",
  emoji: "🏡",
  timezone: "Europe/Madrid",
  createdById: me.id,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  memberCount: 2,
  myLaneColor: "CORAL" as const,
  joinedAt: "2026-11-01T10:00:00.000Z",
};

function renderShell(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  queryClient.setQueryData(meQuery.queryKey, me);
  queryClient.setQueryData(myGroupsQuery.queryKey, [casa]);
  const router = createMemoryRouter(
    [{ element: <AppShell />, children: [{ path: "*", element: <p>Contenido</p> }] }],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => resetConnectionStore());

describe("AppShell (HOG-750, HOG-752)", () => {
  it("en un hogar propio pinta cabecera, contenido y barra inferior", () => {
    renderShell(`/g/${G}/compra`);
    expect(screen.getByRole("button", { name: SWITCHER_TEXT.label("Casa Baiges") })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compra" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Saltar al contenido" })).toHaveAttribute("href", "#contenido");
  });

  it("en un hogar ajeno no hay barra inferior", () => {
    renderShell("/g/0193a0b2-0000-7000-8000-0000000000ff/compra");
    expect(screen.queryByRole("navigation", { name: "Navegación principal" })).not.toBeInTheDocument();
  });

  it("en /perfil usa el último hogar para la barra y marca 'Más'", () => {
    renderShell("/perfil");
    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute("href", `/g/${G}`);
    expect(screen.getByRole("button", { name: /Más/ })).toHaveAttribute("aria-current", "page");
  });

  it("sin conexión muestra un único banner y deshabilita el selector de hogar", () => {
    renderShell(`/g/${G}`);
    expect(screen.queryByText(OFFLINE_MESSAGE)).not.toBeInTheDocument();

    act(() => setBrowserOnline(false));
    expect(screen.getAllByText(OFFLINE_MESSAGE)).toHaveLength(1);
    expect(screen.getByRole("button", { name: SWITCHER_TEXT.label("Casa Baiges") })).toBeDisabled();

    act(() => setBrowserOnline(true));
    expect(screen.queryByText(OFFLINE_MESSAGE)).not.toBeInTheDocument();
  });
});
