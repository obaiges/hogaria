import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastViewport, useToastStore } from "@/components/ui/Toast";
import { apiUrl, http, HttpResponse, server } from "@/test/msw";

import { groupMembersQuery, myGroupsQuery } from "./api";
import { DangerZone, LEAVE_TEXT } from "./components/DangerZone";
import { MemberActions, REMOVE_TEXT } from "./components/RemoveMemberDialog";
import { LAST_GROUP_KEY } from "./landing";
import { groupHandlers, NO_LONGER_MEMBER } from "./realtime";

import type { GroupMemberDto, MyGroupDto, TypedRealtimeEnvelope } from "@hogaria/shared";

const G = "0193a0b2-0000-7000-8000-0000000000a1";
const ANA = "0193a0b2-0000-7000-8000-000000000001";
const LUIS = "0193a0b2-0000-7000-8000-000000000002";

const myGroup: MyGroupDto = {
  id: G,
  name: "Casa Baiges",
  emoji: "🏡",
  timezone: "Europe/Madrid",
  createdById: ANA,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  memberCount: 2,
  myLaneColor: "CORAL",
  joinedAt: "2026-11-01T10:00:00.000Z",
};

const member = (n: number, userId: string, name: string): GroupMemberDto => ({
  id: `0193a0b2-0000-7000-8000-0000000000b${n}`,
  groupId: G,
  userId,
  name,
  username: null,
  image: null,
  laneColor: n === 1 ? "CORAL" : "SEA",
  joinedAt: "2026-11-01T10:00:00.000Z",
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderInRouter(ui: React.ReactNode, seed?: (c: QueryClient) => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  seed?.(queryClient);
  const router = createMemoryRouter(
    [
      { path: "/g/:groupId/ajustes", element: ui },
      { path: "*", element: <Where /> },
    ],
    { initialEntries: [`/g/${G}/ajustes`] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastViewport />
    </QueryClientProvider>,
  );
  return queryClient;
}

afterEach(() => {
  useToastStore.setState({ toasts: [] });
  localStorage.clear();
});

describe("DangerZone (RN-02-20, RN-02-21)", () => {
  it("con más miembros: diálogo normal; al salir va a /grupos con el aviso y olvida el hogar", async () => {
    server.use(http.post(apiUrl(`/groups/${G}/leave`), () => new HttpResponse(null, { status: 204 })));
    localStorage.setItem(LAST_GROUP_KEY, G);
    const client = renderInRouter(<DangerZone groupId={G} groupName="Casa Baiges" memberCount={2} />, (c) =>
      c.setQueryData(myGroupsQuery.queryKey, [myGroup]),
    );

    await userEvent.click(screen.getByRole("button", { name: LEAVE_TEXT.button }));
    const dialog = await screen.findByRole("dialog", { name: LEAVE_TEXT.title("Casa Baiges") });
    expect(within(dialog).getByText(LEAVE_TEXT.body)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: LEAVE_TEXT.button }));

    expect(await screen.findByTestId("where")).toHaveTextContent("/grupos");
    expect(await screen.findByText(LEAVE_TEXT.done("Casa Baiges"))).toBeInTheDocument();
    expect(client.getQueryData(myGroupsQuery.queryKey)).toEqual([]);
    expect(localStorage.getItem(LAST_GROUP_KEY)).toBeNull();
  });

  it("último miembro: avisa de que se borra todo y el botón dice 'Salir y borrar hogar'", async () => {
    renderInRouter(<DangerZone groupId={G} groupName="Casa Baiges" memberCount={1} />);

    await userEvent.click(screen.getByRole("button", { name: LEAVE_TEXT.button }));
    const dialog = await screen.findByRole("dialog", { name: LEAVE_TEXT.lastTitle });
    expect(dialog).toHaveTextContent(LEAVE_TEXT.lastBody("Casa Baiges"));
    expect(within(dialog).getByRole("button", { name: LEAVE_TEXT.buttonLast })).toBeInTheDocument();
  });
});

describe("MemberActions (RN-02-23)", () => {
  it("menú → confirmar → expulsa, quita al miembro y avisa", async () => {
    server.use(http.delete(apiUrl(`/groups/${G}/members/${LUIS}`), () => new HttpResponse(null, { status: 204 })));
    const luis = member(2, LUIS, "Luis");
    const onClose = vi.fn();
    const client = renderInRouter(<MemberActions groupId={G} member={luis} onClose={onClose} />, (c) => {
      c.setQueryData(groupMembersQuery(G).queryKey, [member(1, ANA, "Ana"), luis]);
      c.setQueryData(myGroupsQuery.queryKey, [myGroup]);
    });

    const sheet = await screen.findByRole("dialog", { name: REMOVE_TEXT.options("Luis") });
    await userEvent.click(within(sheet).getByRole("button", { name: REMOVE_TEXT.action }));
    const confirm = await screen.findByRole("dialog", { name: REMOVE_TEXT.title("Luis") });
    expect(within(confirm).getByText(REMOVE_TEXT.body)).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole("button", { name: REMOVE_TEXT.confirm }));

    expect(await screen.findByText(REMOVE_TEXT.done("Luis"))).toBeInTheDocument();
    expect(client.getQueryData<GroupMemberDto[]>(groupMembersQuery(G).queryKey)?.map((m) => m.name)).toEqual(["Ana"]);
    expect(client.getQueryData<MyGroupDto[]>(myGroupsQuery.queryKey)?.[0]?.memberCount).toBe(1);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("group.member.left (RN-02-32)", () => {
  const envelope = (userId: string) =>
    ({
      event: "group.member.left",
      groupId: G,
      actorId: ANA,
      clientMutationId: null,
      at: new Date().toISOString(),
      data: { userId },
    }) as TypedRealtimeEnvelope<"group.member.left">;

  function context(meId: string, activeGroupId: string | null) {
    const queryClient = new QueryClient();
    queryClient.setQueryData(myGroupsQuery.queryKey, [myGroup]);
    queryClient.setQueryData(groupMembersQuery(G).queryKey, [member(1, ANA, "Ana"), member(2, LUIS, "Luis")]);
    queryClient.setQueryData(["group", G, "detail"], { id: G });
    const navigate = vi.fn();
    return { queryClient, meId, activeGroupId, navigate, markRipple: vi.fn(), endSession: vi.fn() };
  }

  it("otro miembro: lo quita de la lista y del contador", () => {
    const ctx = context(ANA, G);
    groupHandlers["group.member.left"]!(envelope(LUIS), ctx);
    expect(ctx.queryClient.getQueryData<GroupMemberDto[]>(groupMembersQuery(G).queryKey)?.map((m) => m.userId)).toEqual([ANA]);
    expect(ctx.queryClient.getQueryData<MyGroupDto[]>(myGroupsQuery.queryKey)?.[0]?.memberCount).toBe(1);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it("yo, en el hogar activo: olvida el hogar, navega a /grupos y avisa", async () => {
    localStorage.setItem(LAST_GROUP_KEY, G);
    const ctx = context(LUIS, G);
    groupHandlers["group.member.left"]!(envelope(LUIS), ctx);

    expect(ctx.navigate).toHaveBeenCalledWith("/grupos");
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual([NO_LONGER_MEMBER("Casa Baiges")]);
    expect(ctx.queryClient.getQueryData(myGroupsQuery.queryKey)).toEqual([]);
    expect(localStorage.getItem(LAST_GROUP_KEY)).toBeNull();
    await waitFor(() => expect(ctx.queryClient.getQueryData(["group", G, "detail"])).toBeUndefined());
  });

  it("yo, viendo otro hogar: olvida el hogar sin navegar ni avisar", () => {
    const ctx = context(LUIS, "otro");
    groupHandlers["group.member.left"]!(envelope(LUIS), ctx);
    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts).toEqual([]);
    expect(ctx.queryClient.getQueryData(myGroupsQuery.queryKey)).toEqual([]);
  });
});
