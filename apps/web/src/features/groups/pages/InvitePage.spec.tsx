import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { ToastViewport, useToastStore } from "@/components/ui/Toast";
import { PENDING_INVITE_KEY } from "@/features/auth/pending-invite";
import { renderRoute } from "@/features/auth/test-utils";
import { apiUrl, http, HttpResponse, server } from "@/test/msw";

import { INVITE_TEXT, InvitePage } from "./InvitePage";

const TOKEN = "tok-abc";
const G = "0193a0b2-0000-7000-8000-0000000000a1";

const me = {
  id: "0193a0b2-0000-7000-8000-000000000002",
  name: "Luis",
  email: "luis@demo.local",
  emailVerified: true,
  username: "luis",
  displayUsername: "luis",
  image: null,
  isPlatformAdmin: false,
  aiNoticeAcceptedAt: null,
  hasPassword: true,
  hasGoogle: false,
  createdAt: "2026-11-01T10:00:00.000Z",
};

const publicInvite = (extra: Record<string, unknown> = {}) => ({
  groupName: "Casa Baiges",
  groupEmoji: "🏡",
  invitedByName: "Ana",
  expiresAt: "2026-11-21T10:00:00.000Z",
  alreadyMember: false,
  groupId: null,
  ...extra,
});

const problem = (status: number, code: string, detail?: string) =>
  HttpResponse.json({ status, code, title: code, detail }, { status });

function mockApi({ signedIn, invite }: { signedIn: boolean; invite: () => Response }) {
  server.use(
    http.get(apiUrl("/me"), () => (signedIn ? HttpResponse.json(me) : problem(401, "UNAUTHENTICATED"))),
    http.get(apiUrl(`/invites/${TOKEN}`), invite),
  );
}

function renderPage() {
  return renderRoute(
    <>
      <InvitePage />
      <ToastViewport />
    </>,
    "/invite/:token",
    `/invite/${TOKEN}`,
  );
}

/** El `ToastViewport` vive en la ruta y se desmonta al navegar: se mira el store. */
const toastMessages = () => useToastStore.getState().toasts.map((t) => t.message);

afterEach(() => {
  useToastStore.setState({ toasts: [] });
  sessionStorage.clear();
});

describe("InvitePage (HOG-103, spec 02 §7)", () => {
  it("válida y sin sesión: crear cuenta guarda la invitación pendiente y va a /registro", async () => {
    mockApi({ signedIn: false, invite: () => HttpResponse.json(publicInvite()) });
    renderPage();

    expect(await screen.findByText("Ana te invita a unirte a")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Casa Baiges/ })).toBeInTheDocument();
    expect(screen.getByText("La invitación caduca el 21 de noviembre.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: INVITE_TEXT.google })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: INVITE_TEXT.haveAccount })).toHaveAttribute(
      "href",
      `/entrar?volver=${encodeURIComponent(`/invite/${TOKEN}`)}`,
    );

    await userEvent.click(screen.getByRole("button", { name: INVITE_TEXT.createAccount }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/registro");
    expect(JSON.parse(sessionStorage.getItem(PENDING_INVITE_KEY) ?? "{}")).toEqual({
      token: TOKEN,
      groupName: "Casa Baiges",
      groupEmoji: "🏡",
    });
  });

  it("válida y con sesión: 'Unirme' acepta, avisa y entra en el hogar", async () => {
    mockApi({ signedIn: true, invite: () => HttpResponse.json(publicInvite()) });
    server.use(http.post(apiUrl(`/invites/${TOKEN}/accept`), () => HttpResponse.json({ groupId: G, alreadyMember: false })));
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: INVITE_TEXT.join("Casa Baiges") }));
    expect(await screen.findByTestId("where")).toHaveTextContent(`/g/${G}`);
    expect(toastMessages()).toContain(INVITE_TEXT.joined("Casa Baiges"));
  });

  it("ya miembro: entra directamente con 'Ya formas parte'", async () => {
    mockApi({ signedIn: true, invite: () => HttpResponse.json(publicInvite({ alreadyMember: true, groupId: G })) });
    renderPage();

    expect(await screen.findByTestId("where")).toHaveTextContent(`/g/${G}`);
    expect(toastMessages()).toContain(INVITE_TEXT.alreadyMember("Casa Baiges"));
  });

  it("410: invitación no válida, sin 'Reintentar'", async () => {
    mockApi({ signedIn: false, invite: () => problem(410, "INVITE_INVALID") });
    renderPage();

    expect(await screen.findByText(INVITE_TEXT.invalid)).toBeInTheDocument();
    expect(screen.getByText(INVITE_TEXT.invalidHint)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: INVITE_TEXT.goHome }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/));
  });

  it("409 al aceptar: hogar lleno", async () => {
    mockApi({ signedIn: true, invite: () => HttpResponse.json(publicInvite()) });
    server.use(
      http.post(apiUrl(`/invites/${TOKEN}/accept`), () =>
        problem(409, "CONFLICT", "Este hogar ya tiene el máximo de 20 miembros"),
      ),
    );
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: INVITE_TEXT.join("Casa Baiges") }));
    expect(await screen.findByRole("alert")).toHaveTextContent(INVITE_TEXT.full);
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();
  });
});
