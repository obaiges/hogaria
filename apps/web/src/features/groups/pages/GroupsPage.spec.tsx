import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { ToastViewport, useToastStore } from "@/components/ui/Toast";
import { renderRoute } from "@/features/auth/test-utils";
import { resetConnectionStore, setBrowserOnline } from "@/lib/realtime/connection-store";
import { apiUrl, http, HttpResponse, server } from "@/test/msw";

import { GROUPS_TEXT, GroupsPage } from "./GroupsPage";

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

const group = (id: string, name: string, emoji: string, memberCount: number) => ({
  id,
  name,
  emoji,
  timezone: "Europe/Madrid",
  createdById: me.id,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  memberCount,
  myLaneColor: "CORAL",
  joinedAt: "2026-11-01T10:00:00.000Z",
});

const CASA = group("0193a0b2-0000-7000-8000-0000000000a1", "Casa Baiges", "🏡", 3);
const PLAYA = group("0193a0b2-0000-7000-8000-0000000000a2", "Apartamento playa", "🌊", 1);

function mockApi(groups: unknown[]) {
  server.use(
    http.get(apiUrl("/me"), () => HttpResponse.json(me)),
    http.get(apiUrl("/me/groups"), () => HttpResponse.json(groups)),
  );
}

function renderPage() {
  return renderRoute(
    <>
      <GroupsPage />
      <ToastViewport />
    </>,
    "/grupos",
    "/grupos",
  );
}

afterEach(() => {
  resetConnectionStore();
  useToastStore.setState({ toasts: [] });
});

describe("GroupsPage", () => {
  it("lista los hogares con su número de miembros y enlace", async () => {
    mockApi([CASA, PLAYA]);
    renderPage();
    const casa = await screen.findByRole("link", { name: /Casa Baiges/ });
    expect(casa).toHaveAttribute("href", `/g/${CASA.id}`);
    expect(casa).toHaveTextContent("3 miembros");
    expect(screen.getByRole("link", { name: /Apartamento playa/ })).toHaveTextContent("1 miembro");
    expect(screen.getByRole("button", { name: GROUPS_TEXT.create })).toBeEnabled();
  });

  it("vacío: mensaje, acción de crear y aviso de invitación", async () => {
    mockApi([]);
    renderPage();
    expect(await screen.findByText(GROUPS_TEXT.empty)).toBeInTheDocument();
    expect(screen.getByText(GROUPS_TEXT.invited)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: GROUPS_TEXT.create })).toBeInTheDocument();
  });

  it("error → mensaje y Reintentar", async () => {
    server.use(
      http.get(apiUrl("/me"), () => HttpResponse.json(me)),
      http.get(apiUrl("/me/groups"), () => HttpResponse.json({ code: "INTERNAL" }, { status: 500 })),
    );
    renderPage();
    expect(await screen.findByText(GROUPS_TEXT.error)).toBeInTheDocument();
    mockApi([CASA]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("link", { name: /Casa Baiges/ })).toBeInTheDocument();
  });

  it("sin conexión, 'Crear hogar' está deshabilitado", async () => {
    mockApi([CASA]);
    setBrowserOnline(false);
    renderPage();
    await screen.findByRole("link", { name: /Casa Baiges/ });
    expect(screen.getByRole("button", { name: GROUPS_TEXT.create })).toBeDisabled();
  });

  it("crear hogar: valida, envía, navega a /g/:id y muestra el toast", async () => {
    mockApi([CASA]);
    let body: unknown;
    const created = group("0193a0b2-0000-7000-8000-0000000000a3", "Casa nueva", "🐶", 1);
    server.use(
      http.post(apiUrl("/groups"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    const { queryClient } = renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: GROUPS_TEXT.create }));
    const sheet = await screen.findByRole("dialog", { name: "Crear hogar" });

    await user.click(within(sheet).getByRole("button", { name: "Crear hogar" }));
    expect(await within(sheet).findByText("Escribe el nombre del hogar")).toBeInTheDocument();

    await user.type(within(sheet).getByLabelText("Nombre del hogar"), "  Casa nueva ");
    await user.click(within(sheet).getByRole("radio", { name: "🐶" }));
    expect(within(sheet).getByRole("radio", { name: "🐶" })).toHaveAttribute("aria-checked", "true");
    await user.click(within(sheet).getByRole("button", { name: "Crear hogar" }));

    expect(await screen.findByTestId("where")).toHaveTextContent(`/g/${created.id}`);
    expect(body).toEqual({ name: "Casa nueva", emoji: "🐶", timezone: "Europe/Madrid" });
    expect(useToastStore.getState().toasts.map((t) => t.message)).toContain("Hogar creado");
    await waitFor(() => expect(queryClient.getQueryData<unknown[]>(["me", "groups"])).toHaveLength(2));
  });

  it("'Otro emoji' sustituye a la rejilla y se valida", async () => {
    mockApi([]);
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: GROUPS_TEXT.create }));
    const sheet = await screen.findByRole("dialog", { name: "Crear hogar" });
    await user.type(within(sheet).getByLabelText("Nombre del hogar"), "Casa");
    await user.type(within(sheet).getByLabelText("Otro emoji"), "ab");
    await user.click(within(sheet).getByRole("button", { name: "Crear hogar" }));
    expect(await within(sheet).findByText("Elige un único emoji")).toBeInTheDocument();
    expect(within(sheet).getAllByRole("radio").every((r) => r.getAttribute("aria-checked") === "false")).toBe(true);
  });
});
