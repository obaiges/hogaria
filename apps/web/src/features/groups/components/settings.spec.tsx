import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastViewport, useToastStore } from "@/components/ui/Toast";
import { apiUrl, http, HttpResponse, server } from "@/test/msw";

import { groupInvitesQuery, groupMembersQuery } from "../api";
import { INVITE_LINK_TEXT, InviteLinkSheet } from "./InviteLinkSheet";
import { INVITES_TEXT, InvitesSection } from "./InvitesSection";
import { ALL_COLORS_TAKEN, LaneColorPicker } from "./LaneColorPicker";

import type { GroupInviteDto, GroupMemberDto } from "@hogaria/shared";

const G = "0193a0b2-0000-7000-8000-0000000000a1";
const ANA = "0193a0b2-0000-7000-8000-000000000001";
const LUIS = "0193a0b2-0000-7000-8000-000000000002";

const member = (n: number, userId: string, name: string, laneColor: GroupMemberDto["laneColor"]): GroupMemberDto => ({
  id: `0193a0b2-0000-7000-8000-0000000000b${n}`,
  groupId: G,
  userId,
  name,
  username: null,
  image: null,
  laneColor,
  joinedAt: "2026-11-01T10:00:00.000Z",
});

const invite = (n: number, status: GroupInviteDto["status"], extra: Partial<GroupInviteDto> = {}): GroupInviteDto => ({
  id: `0193a0b2-0000-7000-8000-0000000000c${n}`,
  groupId: G,
  status,
  createdById: ANA,
  createdByName: "Ana",
  usedById: null,
  usedByName: null,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 - 60_000).toISOString(),
  usedAt: null,
  revokedAt: null,
  createdAt: "2026-11-10T10:00:00.000Z",
  ...extra,
});

function renderWithClient(ui: React.ReactNode, seed?: (client: QueryClient) => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  seed?.(queryClient);
  render(
    <QueryClientProvider client={queryClient}>
      {ui}
      <ToastViewport />
    </QueryClientProvider>,
  );
  return queryClient;
}

afterEach(() => {
  useToastStore.setState({ toasts: [] });
  vi.unstubAllGlobals();
});

describe("LaneColorPicker (RN-02-09)", () => {
  const ana = member(1, ANA, "Ana", "CORAL");
  const luis = member(2, LUIS, "Luis", "SEA");

  function renderPicker(members: GroupMemberDto[], me = ana) {
    return renderWithClient(<LaneColorPicker groupId={G} me={me} members={members} />, (c) =>
      c.setQueryData(groupMembersQuery(G).queryKey, members),
    );
  }

  it("marca el propio y deshabilita los ocupados con la inicial y quién lo tiene", () => {
    renderPicker([ana, luis]);
    expect(screen.getByRole("radio", { name: "Coral" })).toHaveAttribute("aria-checked", "true");
    const taken = screen.getByRole("radio", { name: "Mar, lo tiene Luis" });
    expect(taken).toBeDisabled();
    expect(taken).toHaveTextContent("L");
    expect(screen.getByRole("radio", { name: "Sol" })).toBeEnabled();
    expect(screen.queryByText(ALL_COLORS_TAKEN)).not.toBeInTheDocument();
  });

  it("guarda al momento y, con 409, deshace y muestra el mensaje", async () => {
    server.use(
      http.patch(apiUrl(`/groups/${G}/members/me`), () =>
        HttpResponse.json({ status: 409, code: "CONFLICT", title: "Conflicto", detail: "Ese color ya lo tiene Luis" }, { status: 409 }),
      ),
    );
    const client = renderPicker([ana, luis]);
    await userEvent.click(screen.getByRole("radio", { name: "Sol" }));

    expect(await screen.findByText("Ese color ya lo tiene Luis")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("radio", { name: "Coral" })).toHaveAttribute("aria-checked", "true"));
    expect(client.getQueryData<GroupMemberDto[]>(groupMembersQuery(G).queryKey)?.[0]?.laneColor).toBe("CORAL");
  });

  it("con los 8 colores ocupados por otros avisa de que están todos en uso", () => {
    const others = (["SEA", "SUN", "LEAF", "VIOLET", "ROSE", "ORANGE", "SLATE", "CORAL"] as const).map((c, i) =>
      member(i + 2, `0193a0b2-0000-7000-8000-00000000010${i}`, `M${i}`, c),
    );
    const me = member(1, ANA, "Ana", "CORAL");
    renderPicker([me, ...others], me);
    expect(screen.getByText(ALL_COLORS_TAKEN)).toBeInTheDocument();
  });
});

describe("InviteLinkSheet", () => {
  const props = {
    open: true,
    onOpenChange: () => {},
    url: "https://hogaria.app/invite/abc",
    expiresAt: "2026-11-25T10:00:00.000Z",
    groupName: "Casa Baiges",
    myName: "Ana",
    timezone: "Europe/Madrid",
  };

  it("sin navigator.share no ofrece compartir; copiar usa el portapapeles", async () => {
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    renderWithClient(<InviteLinkSheet {...props} />);

    const sheet = screen.getByRole("dialog", { name: INVITE_LINK_TEXT.title });
    expect(within(sheet).getByText(INVITE_LINK_TEXT.notice("25 de noviembre"))).toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: INVITE_LINK_TEXT.share })).not.toBeInTheDocument();

    await userEvent.click(within(sheet).getByRole("button", { name: INVITE_LINK_TEXT.copy }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(props.url);
    expect(await screen.findByText(INVITE_LINK_TEXT.copied)).toBeInTheDocument();
  });

  it("sin portapapeles selecciona el texto del enlace", async () => {
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: undefined });
    renderWithClient(<InviteLinkSheet {...props} />);

    await userEvent.click(screen.getByRole("button", { name: INVITE_LINK_TEXT.copy }));
    const field = screen.getByLabelText("Enlace");
    expect(field).toHaveFocus();
    expect(screen.queryByText(INVITE_LINK_TEXT.copied)).not.toBeInTheDocument();
  });

  it("con navigator.share comparte; cancelar no muestra error", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelado", "AbortError"));
    vi.stubGlobal("navigator", { ...navigator, share });
    renderWithClient(<InviteLinkSheet {...props} />);

    await userEvent.click(screen.getByRole("button", { name: INVITE_LINK_TEXT.share }));
    expect(share).toHaveBeenCalledWith({
      title: "Únete a Casa Baiges en Hogaria",
      text: "Ana te invita a Casa Baiges en Hogaria",
      url: props.url,
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("InvitesSection (RN-02-14, RN-02-15)", () => {
  const pending = invite(1, "ACTIVE");
  const used = invite(2, "USED", { usedById: LUIS, usedByName: "Luis", usedAt: "2026-11-11T10:00:00.000Z" });

  function renderSection(list: GroupInviteDto[]) {
    server.use(http.get(apiUrl(`/groups/${G}/invites`), () => HttpResponse.json(list)));
    return renderWithClient(<InvitesSection groupId={G} groupName="Casa Baiges" myName="Ana" timezone="Europe/Madrid" />);
  }

  it("lista pendientes y anteriores", async () => {
    renderSection([pending, used]);
    expect(await screen.findByText(/Creada por Ana · caduca en 7 días/)).toBeInTheDocument();
    expect(screen.getByText(INVITES_TEXT.previous)).toBeInTheDocument();
    expect(screen.getByText("Usada por Luis")).toBeInTheDocument();
  });

  it("sin pendientes muestra el vacío", async () => {
    renderSection([used]);
    expect(await screen.findByText(INVITES_TEXT.empty)).toBeInTheDocument();
  });

  it("revocar pide confirmación, revoca y la pasa a anteriores", async () => {
    server.use(
      http.delete(apiUrl(`/groups/${G}/invites/${pending.id}`), () =>
        HttpResponse.json({ ...pending, status: "REVOKED", revokedAt: "2026-11-18T10:00:00.000Z" }),
      ),
    );
    const client = renderSection([pending]);
    await userEvent.click(await screen.findByRole("button", { name: INVITES_TEXT.revoke }));

    const dialog = await screen.findByRole("dialog", { name: INVITES_TEXT.revokeTitle });
    expect(within(dialog).getByText(INVITES_TEXT.revokeBody)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: INVITES_TEXT.revoke }));

    expect(await screen.findByText(INVITES_TEXT.revoked)).toBeInTheDocument();
    expect(screen.getByText(INVITES_TEXT.empty)).toBeInTheDocument();
    expect(screen.getByText("Revocada")).toBeInTheDocument();
    expect(client.getQueryData<GroupInviteDto[]>(groupInvitesQuery(G).queryKey)?.[0]?.status).toBe("REVOKED");
  });

  it("'Invitar a alguien' crea la invitación y abre el enlace", async () => {
    server.use(
      http.post(apiUrl(`/groups/${G}/invites`), () =>
        HttpResponse.json({ invite: pending, token: "tok", url: "https://hogaria.app/invite/tok" }, { status: 201 }),
      ),
    );
    renderSection([]);
    await screen.findByText(INVITES_TEXT.empty);
    await userEvent.click(screen.getByRole("button", { name: INVITES_TEXT.invite }));

    const sheet = await screen.findByRole("dialog", { name: INVITE_LINK_TEXT.title });
    expect(within(sheet).getByLabelText("Enlace")).toHaveValue("https://hogaria.app/invite/tok");
    expect(await screen.findByText(/Creada por Ana/)).toBeInTheDocument();
  });
});
