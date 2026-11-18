import { QueryClient } from "@tanstack/react-query";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderRoute } from "@/features/auth/test-utils";
import { GroupProvider, type ActiveGroup } from "@/features/groups/GroupProvider";
import { apiUrl, http, HttpResponse, server } from "@/test/msw";

import { actorLabel, dayLabel, groupByDay, systemSummary, timeLabel } from "./activity-format";
import { activityQuery, type ActivityPages } from "./api";
import { ACTIVITY_TEXT, ActivityPage } from "./pages/ActivityPage";
import { activityHandlers, activityRippleKey } from "./realtime";

import type { ActivityDto, TypedRealtimeEnvelope } from "@hogaria/shared";

const G = "0193a0b2-0000-7000-8000-0000000000a1";
const ANA = "0193a0b2-0000-7000-8000-000000000001";
const NOW = new Date("2026-11-18T10:00:00.000Z");

let seq = 0;
const item = (createdAt: string, extra: Partial<ActivityDto> = {}): ActivityDto => ({
  id: `0193a0b2-0000-7000-8000-${String(++seq).padStart(12, "0")}`,
  groupId: G,
  actorId: ANA,
  actorName: "Ana",
  entityType: "group",
  entityId: G,
  action: "updated",
  summary: "cambió el nombre del hogar a «Casa»",
  metadata: null,
  createdAt,
  ...extra,
});

describe("agrupación por días (RN-03-32)", () => {
  it("23:30 UTC de ayer es 'Hoy' en Madrid y 'Ayer' en Canarias", () => {
    const late = item("2026-11-17T23:30:00.000Z");
    expect(groupByDay([late], "Europe/Madrid", NOW).map((d) => d.label)).toEqual(["Hoy"]);
    expect(groupByDay([late], "Atlantic/Canary", NOW).map((d) => d.label)).toEqual(["Ayer"]);
  });

  it("agrupa conservando el orden y nombra los días anteriores", () => {
    const days = groupByDay(
      [item("2026-11-18T09:00:00.000Z"), item("2026-11-18T08:00:00.000Z"), item("2026-11-17T10:00:00.000Z"), item("2026-11-16T10:00:00.000Z")],
      "Europe/Madrid",
      NOW,
    );
    expect(days.map((d) => [d.label, d.items.length])).toEqual([
      ["Hoy", 2],
      ["Ayer", 1],
      ["lunes 16 de noviembre", 1],
    ]);
  });

  it("de otro año lleva el año", () => {
    expect(dayLabel("2025-12-31", "Europe/Madrid", NOW)).toMatch(/2025/);
  });

  it("hora: relativa hoy y HH:mm otros días, en la zona del hogar", () => {
    expect(timeLabel("2026-11-18T09:59:40.000Z", "Europe/Madrid", NOW)).toBe("ahora mismo");
    expect(timeLabel("2026-11-18T09:55:00.000Z", "Europe/Madrid", NOW)).toBe("hace 5 min");
    expect(timeLabel("2026-11-18T07:30:00.000Z", "Europe/Madrid", NOW)).toBe("hace 2 h");
    expect(timeLabel("2026-11-16T10:05:00.000Z", "Europe/Madrid", NOW)).toBe("11:05");
    expect(timeLabel("2026-11-16T10:05:00.000Z", "Atlantic/Canary", NOW)).toBe("10:05");
  });

  it("autor: nombre, 'Usuario eliminado' o sistema (RN-03-28)", () => {
    expect(actorLabel({ actorId: ANA, actorName: "Ana" })).toBe("Ana");
    expect(actorLabel({ actorId: ANA, actorName: null })).toBe("Usuario eliminado");
    expect(actorLabel({ actorId: null, actorName: null })).toBeNull();
    expect(systemSummary("se generó el recordatorio")).toBe("Se generó el recordatorio");
  });
});

describe("activity.created", () => {
  const envelope = (data: ActivityDto) =>
    ({ event: "activity.created", groupId: G, actorId: ANA, clientMutationId: null, at: NOW.toISOString(), data }) as TypedRealtimeEnvelope<"activity.created">;

  function ctx(client: QueryClient) {
    return { queryClient: client, meId: ANA, activeGroupId: G, navigate: vi.fn(), markRipple: vi.fn(), endSession: vi.fn() };
  }

  it("inserta al principio de la primera página sin duplicar, con onda", () => {
    const client = new QueryClient();
    const old = item("2026-11-18T08:00:00.000Z");
    client.setQueryData<ActivityPages>(activityQuery(G).queryKey, { pages: [{ items: [old], nextCursor: "c" }, { items: [], nextCursor: null }], pageParams: [null, "c"] });
    const c = ctx(client);
    const fresh = item("2026-11-18T09:00:00.000Z");

    activityHandlers["activity.created"]!(envelope(fresh), c);
    activityHandlers["activity.created"]!(envelope(fresh), c);

    const pages = client.getQueryData<ActivityPages>(activityQuery(G).queryKey)!.pages;
    expect(pages[0]!.items.map((i) => i.id)).toEqual([fresh.id, old.id]);
    expect(pages).toHaveLength(2);
    expect(c.markRipple).toHaveBeenCalledWith(activityRippleKey(fresh.id));
  });

  it("sin la query en caché no la crea", () => {
    const client = new QueryClient();
    activityHandlers["activity.created"]!(envelope(item("2026-11-18T09:00:00.000Z")), ctx(client));
    expect(client.getQueryData(activityQuery(G).queryKey)).toBeUndefined();
  });
});

describe("ActivityPage", () => {
  const active: ActiveGroup = {
    group: { id: G, name: "Casa", emoji: "🏡", timezone: "Europe/Madrid", createdById: ANA, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() },
    members: [{ id: "0193a0b2-0000-7000-8000-0000000000b1", groupId: G, userId: ANA, name: "Ana", username: null, image: null, laneColor: "CORAL", joinedAt: NOW.toISOString() }],
    me: { id: "0193a0b2-0000-7000-8000-0000000000b1", groupId: G, userId: ANA, name: "Ana", username: null, image: null, laneColor: "CORAL", joinedAt: NOW.toISOString() },
    timezone: "Europe/Madrid",
  };

  function renderPage() {
    return renderRoute(
      <GroupProvider value={active}>
        <ActivityPage />
      </GroupProvider>,
      "/g/:groupId/actividad",
      `/g/${G}/actividad`,
    );
  }

  it("pinta las filas con autor, 'Usuario eliminado' y sistema; al final, el texto de los 90 días", async () => {
    const now = new Date().toISOString();
    server.use(
      http.get(apiUrl(`/groups/${G}/activity`), () =>
        HttpResponse.json({
          items: [
            item(now, { summary: "creó una invitación" }),
            item(now, { actorName: null, summary: "revocó una invitación" }),
            item(now, { actorId: null, actorName: null, summary: "generó los recordatorios" }),
          ],
          nextCursor: null,
        }),
      ),
    );
    renderPage();

    const today = await screen.findByRole("region", { name: "Hoy" });
    const rows = within(today).getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent);
    expect(rows).toEqual(["Ana creó una invitación", "Usuario eliminado revocó una invitación", "Generó los recordatorios"]);
    expect(screen.getByText(ACTIVITY_TEXT.end)).toBeInTheDocument();
  });

  it("vacío", async () => {
    server.use(http.get(apiUrl(`/groups/${G}/activity`), () => HttpResponse.json({ items: [], nextCursor: null })));
    renderPage();
    expect(await screen.findByText(ACTIVITY_TEXT.empty)).toBeInTheDocument();
  });

  it("error con Reintentar", async () => {
    let fail = true;
    server.use(
      http.get(apiUrl(`/groups/${G}/activity`), () =>
        fail ? HttpResponse.json({ status: 500, code: "INTERNAL" }, { status: 500 }) : HttpResponse.json({ items: [], nextCursor: null }),
      ),
    );
    renderPage();
    expect(await screen.findByText(ACTIVITY_TEXT.error)).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(ACTIVITY_TEXT.empty)).toBeInTheDocument();
  });

  it("'Cargar más' pide la página siguiente con el cursor", async () => {
    const now = new Date().toISOString();
    server.use(
      http.get(apiUrl(`/groups/${G}/activity`), ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        return HttpResponse.json(
          cursor === "c1"
            ? { items: [item(now, { summary: "salió del hogar" })], nextCursor: null }
            : { items: [item(now, { summary: "se unió al hogar" })], nextCursor: "c1" },
        );
      }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: ACTIVITY_TEXT.loadMore }));
    expect(await screen.findByText("salió del hogar")).toBeInTheDocument();
    expect(screen.getByText(ACTIVITY_TEXT.end)).toBeInTheDocument();
  });
});
