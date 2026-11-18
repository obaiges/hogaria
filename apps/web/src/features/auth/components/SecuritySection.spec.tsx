import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastViewport } from "@/components/ui/Toast";
import { resetConnectionStore, setBrowserOnline } from "@/lib/realtime/connection-store";
import { http, HttpResponse, server } from "@/test/msw";

import { authUrl, renderRoute } from "../test-utils";
import { SECURITY_TEXT, SecuritySection } from "./SecuritySection";

const NOW = Date.now();
const iso = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();
const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const UA_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";
const UA_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

const session = (id: string, userAgent: string, minutesAgo: number) => ({
  id,
  token: `tok-${id}`,
  userId: "u1",
  createdAt: iso(600),
  updatedAt: iso(minutesAgo),
  expiresAt: iso(-60 * 24 * 365),
  ipAddress: "1.2.3.4",
  userAgent,
});

function mockSessions(list = [session("s1", UA_ANDROID, 0), session("s2", UA_WINDOWS, 30), session("s3", UA_IPHONE, 5)]) {
  server.use(
    http.get(authUrl("/list-sessions"), () => HttpResponse.json(list)),
    http.get(authUrl("/get-session"), () => HttpResponse.json({ session: list[0], user: { id: "u1", email: "ana@demo.local", name: "Ana" } })),
  );
}

function renderSection() {
  return renderRoute(
    <>
      <SecuritySection />
      <ToastViewport />
    </>,
    "/perfil",
    "/perfil",
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  resetConnectionStore();
});

describe("SecuritySection", () => {
  it("lista los dispositivos por última actividad con el chip del actual", async () => {
    mockSessions();
    renderSection();
    await screen.findByText("Chrome en Android");
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining("Chrome en Android"),
      expect.stringContaining("Safari en iPhone"),
      expect.stringContaining("Firefox en Windows"),
    ]);
    expect(within(items[0]!).getByText(SECURITY_TEXT.thisDevice)).toBeInTheDocument();
    expect(within(items[0]!).queryByRole("button")).toBeNull();
    expect(within(items[2]!).getByText("Última actividad hace 30 min")).toBeInTheDocument();
  });

  it("cierra una sesión con confirmación y muestra el toast", async () => {
    mockSessions();
    let body: unknown;
    server.use(
      http.post(authUrl("/revoke-session"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ status: true });
      }),
    );
    renderSection();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Cerrar sesión en Firefox en Windows" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Cerrar la sesión en Firefox en Windows?" });
    await user.click(within(dialog).getByRole("button", { name: SECURITY_TEXT.closeSession }));
    expect(await screen.findByText(SECURITY_TEXT.sessionClosed)).toBeInTheDocument();
    expect(body).toEqual({ token: "tok-s2" });
  });

  it("cierra todas las demás tras confirmar", async () => {
    mockSessions();
    const revoke = vi.fn(() => HttpResponse.json({ status: true }));
    server.use(http.post(authUrl("/revoke-other-sessions"), revoke));
    renderSection();
    const user = userEvent.setup();
    await screen.findByText("Chrome en Android");
    await user.click(screen.getByRole("button", { name: SECURITY_TEXT.closeOthers }));
    const dialog = await screen.findByRole("dialog", { name: SECURITY_TEXT.closeOthersConfirm });
    await user.click(within(dialog).getByRole("button", { name: SECURITY_TEXT.closeOthers }));
    expect(await screen.findByText(SECURITY_TEXT.othersClosed)).toBeInTheDocument();
    expect(revoke).toHaveBeenCalledOnce();
  });

  it("con una sola sesión, 'cerrar en todos los demás' está deshabilitado", async () => {
    mockSessions([session("s1", UA_ANDROID, 0)]);
    renderSection();
    await screen.findByText("Chrome en Android");
    expect(screen.getByRole("button", { name: SECURITY_TEXT.closeOthers })).toBeDisabled();
  });

  it("cerrar sesión llama a sign-out y va a /entrar", async () => {
    mockSessions();
    const signOut = vi.fn(() => HttpResponse.json({ success: true }));
    server.use(http.post(authUrl("/sign-out"), signOut));
    renderSection();
    const user = userEvent.setup();
    await screen.findByText("Chrome en Android");
    const buttons = screen.getAllByRole("button", { name: SECURITY_TEXT.signOut });
    await user.click(buttons[buttons.length - 1]!);
    expect(await screen.findByTestId("where")).toHaveTextContent("/entrar");
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("error al cargar → mensaje y Reintentar", async () => {
    server.use(
      http.get(authUrl("/list-sessions"), () => HttpResponse.json({ message: "boom" }, { status: 500 })),
      http.get(authUrl("/get-session"), () => HttpResponse.json(null)),
    );
    renderSection();
    expect(await screen.findByText(SECURITY_TEXT.loadError)).toBeInTheDocument();
    mockSessions();
    await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(3));
  });

  it("sin conexión deshabilita las acciones", async () => {
    setBrowserOnline(false);
    mockSessions();
    renderSection();
    await screen.findByText("Chrome en Android");
    expect(screen.getByText(SECURITY_TEXT.offline)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SECURITY_TEXT.closeOthers })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cerrar sesión en Firefox en Windows" })).toBeDisabled();
  });
});
