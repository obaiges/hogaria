import { QueryClient } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderRoute } from "@/features/auth/test-utils";
import { GroupProvider, type ActiveGroup } from "@/features/groups/GroupProvider";
import { apiUrl, http, HttpResponse, server } from "@/test/msw";

import { dashboardKey } from "./api";
import { DashboardSection } from "./components/DashboardSection";
import { LANES_TEXT, TodayLanes } from "./components/TodayLanes";
import { HOME_TEXT, HomePage } from "./pages/HomePage";
import { dashboardHandlers, laneRippleKey } from "./realtime";

import type { ActivityDto, DashboardDto, DashboardMemberDto, TypedRealtimeEnvelope } from "@hogaria/shared";

const G = "0193a0b2-0000-7000-8000-0000000000a1";
const ANA = "0193a0b2-0000-7000-8000-000000000001";
const LUIS = "0193a0b2-0000-7000-8000-000000000002";

const ana: DashboardMemberDto = { userId: ANA, name: "Ana", image: null, laneColor: "CORAL", isMe: true };
const luis: DashboardMemberDto = { userId: LUIS, name: "Luis", image: null, laneColor: "SEA", isMe: false };

let seq = 0;
const activity = (summary: string): ActivityDto => ({
  id: `0193a0b2-0000-7000-8000-${String(++seq).padStart(12, "0")}`,
  groupId: G,
  actorId: LUIS,
  actorName: "Luis",
  entityType: "group",
  entityId: G,
  action: "updated",
  summary,
  metadata: null,
  createdAt: new Date().toISOString(),
});

const dashboard = (members: DashboardMemberDto[], items: ActivityDto[] = []): DashboardDto => ({
  date: "2026-11-18",
  timezone: "Europe/Madrid",
  members,
  lanes: members.map((m) => ({ userId: m.userId })),
  activity: items,
});

describe("TodayLanes", () => {
  it("sin sub-secciones: 'Tú', los nombres y 'Nada para hoy' en cada calle", () => {
    render(<TodayLanes lanes={[{ userId: ANA }, { userId: LUIS }]} members={[ana, luis]} />);
    const lanes = screen.getAllByRole("group");
    expect(lanes.map((l) => l.getAttribute("aria-label"))).toEqual(["Calle de Tú", "Calle de Luis"]);
    expect(within(lanes[1]!).getByText(LANES_TEXT.nothing)).toBeInTheDocument();
  });

  it("la calle sin dueño se llama 'Sin asignar'", () => {
    render(<TodayLanes lanes={[{ userId: null, tasks: { items: [], moreCount: 0 } }]} members={[]} />);
    expect(screen.getByRole("group", { name: `Calle de ${LANES_TEXT.unassigned}` })).toBeInTheDocument();
  });
});

describe("DashboardSection (RN-15-20)", () => {
  it("no pinta nada si la clave falta", () => {
    const { container } = render(<DashboardSection data={undefined}>{() => <p>Compra</p>}</DashboardSection>);
    expect(container).toBeEmptyDOMElement();
    render(<DashboardSection data={{ totalPending: 3 }}>{(d) => <p>Quedan {d.totalPending}</p>}</DashboardSection>);
    expect(screen.getByText("Quedan 3")).toBeInTheDocument();
  });
});

describe("HomePage", () => {
  const me = { id: "0193a0b2-0000-7000-8000-0000000000b1", groupId: G, userId: ANA, name: "Ana", username: null, image: null, laneColor: "CORAL" as const, joinedAt: "2026-11-01T10:00:00.000Z" };
  const active: ActiveGroup = {
    group: { id: G, name: "Casa", emoji: "🏡", timezone: "Europe/Madrid", createdById: ANA, createdAt: me.joinedAt, updatedAt: me.joinedAt },
    members: [me],
    me,
    timezone: "Europe/Madrid",
  };
  const renderPage = () =>
    renderRoute(
      <GroupProvider value={active}>
        <HomePage />
      </GroupProvider>,
      "/g/:groupId",
      `/g/${G}`,
    );

  it("con un único miembro: saludo, calle, invitación y actividad vacía", async () => {
    server.use(http.get(apiUrl(`/groups/${G}/dashboard`), () => HttpResponse.json(dashboard([ana]))));
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: /, Ana$/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Calle de Tú" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(HOME_TEXT.inviteTitle) })).toHaveAttribute("href", `/g/${G}/ajustes`);
    expect(screen.getByText("Todavía no hay actividad. ¡Empezad a usar Hogaria!")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver toda la actividad" })).toHaveAttribute("href", `/g/${G}/actividad`);
  });

  it("con más miembros no muestra la invitación y pinta la actividad", async () => {
    server.use(http.get(apiUrl(`/groups/${G}/dashboard`), () => HttpResponse.json(dashboard([ana, luis], [activity("se unió al hogar")]))));
    renderPage();
    expect(await screen.findByText("se unió al hogar")).toBeInTheDocument();
    expect(screen.queryByText(HOME_TEXT.inviteTitle)).not.toBeInTheDocument();
  });

  it("pide el día de hoy en la zona del grupo", async () => {
    let requested: string | null = null;
    server.use(
      http.get(apiUrl(`/groups/${G}/dashboard`), ({ request }) => {
        requested = new URL(request.url).searchParams.get("date");
        return HttpResponse.json(dashboard([ana]));
      }),
    );
    renderPage();
    await screen.findByRole("group", { name: "Calle de Tú" });
    expect(requested).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("error con Reintentar (el saludo sigue)", async () => {
    let fail = true;
    server.use(
      http.get(apiUrl(`/groups/${G}/dashboard`), () =>
        fail ? HttpResponse.json({ status: 500, code: "INTERNAL" }, { status: 500 }) : HttpResponse.json(dashboard([ana])),
      ),
    );
    renderPage();
    expect(await screen.findByText(HOME_TEXT.error)).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("group", { name: "Calle de Tú" })).toBeInTheDocument();
  });

  it("cargando: esqueleto", () => {
    server.use(http.get(apiUrl(`/groups/${G}/dashboard`), () => new Promise(() => {})));
    renderPage();
    expect(screen.getByLabelText("Cargando el inicio")).toBeInTheDocument();
  });
});

describe("manejadores del Inicio (spec 15 §6)", () => {
  const ctx = (client: QueryClient) => ({ queryClient: client, meId: ANA, activeGroupId: G, navigate: vi.fn(), markRipple: vi.fn(), endSession: vi.fn() });
  const env = (event: string, data: unknown) =>
    ({ event, groupId: G, actorId: LUIS, clientMutationId: null, at: new Date().toISOString(), data }) as TypedRealtimeEnvelope<"activity.created">;

  it("activity.created: arriba, como mucho 5 y sin duplicar", () => {
    const client = new QueryClient();
    const old = Array.from({ length: 5 }, (_, i) => activity(`antigua ${i}`));
    client.setQueryData(dashboardKey(G, "2026-11-18"), dashboard([ana], old));
    const fresh = activity("nueva");
    dashboardHandlers["activity.created"]!(env("activity.created", fresh), ctx(client));
    dashboardHandlers["activity.created"]!(env("activity.created", fresh), ctx(client));
    const items = client.getQueryData<DashboardDto>(dashboardKey(G, "2026-11-18"))!.activity;
    expect(items.map((a) => a.summary)).toEqual(["nueva", "antigua 0", "antigua 1", "antigua 2", "antigua 3"]);
  });

  it("activity.created sin el Inicio en caché no lo crea", () => {
    const client = new QueryClient();
    dashboardHandlers["activity.created"]!(env("activity.created", activity("x")), ctx(client));
    expect(client.getQueryData(dashboardKey(G, "2026-11-18"))).toBeUndefined();
  });

  it("eventos de miembros: invalida el Inicio y hace la onda en la calle", () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const c = ctx(client);
    const member = { id: "m", groupId: G, userId: LUIS, name: "Luis", username: null, image: null, laneColor: "SEA", joinedAt: "2026-11-01T10:00:00.000Z" };
    dashboardHandlers["group.member.updated"]!(env("group.member.updated", member) as never, c);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["group", G, "dashboard"] });
    expect(c.markRipple).toHaveBeenCalledWith(laneRippleKey(LUIS));
  });
});
