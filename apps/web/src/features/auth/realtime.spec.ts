import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { http, HttpResponse, server } from "@/test/msw";

import { sessionsQueryKey, toSessionDtos } from "./api";
import { authHandlers } from "./realtime";
import { authUrl } from "./test-utils";

import type { TypedRealtimeEnvelope } from "@hogaria/shared";

const envelope = {
  event: "session.revoked",
  groupId: null,
  actorId: "u1",
  clientMutationId: null,
  at: new Date().toISOString(),
  data: {},
} as unknown as TypedRealtimeEnvelope<"session.revoked">;

function run() {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const endSession = vi.fn();
  authHandlers["session.revoked"]!(envelope, { queryClient, meId: "u1", markRipple: vi.fn(), endSession, activeGroupId: null, navigate: vi.fn() });
  return { invalidate, endSession };
}

describe("session.revoked", () => {
  it("si la sesión de este dispositivo ya no existe → endSession", async () => {
    server.use(http.get(authUrl("/get-session"), () => HttpResponse.json(null)));
    const { invalidate, endSession } = run();
    await waitFor(() => expect(endSession).toHaveBeenCalledOnce());
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("si sigue viva → solo refresca la lista de dispositivos", async () => {
    server.use(http.get(authUrl("/get-session"), () => HttpResponse.json({ session: { id: "s1" }, user: { id: "u1" } })));
    const { invalidate, endSession } = run();
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: sessionsQueryKey }));
    expect(endSession).not.toHaveBeenCalled();
  });

  it("un error de red no cierra la sesión", async () => {
    server.use(http.get(authUrl("/get-session"), () => HttpResponse.error()));
    const { invalidate, endSession } = run();
    await new Promise((r) => setTimeout(r, 50));
    expect(endSession).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("toSessionDtos", () => {
  it("ordena por updatedAt desc, marca la actual y etiqueta el dispositivo", () => {
    const base = { token: "t", createdAt: new Date("2026-11-01T10:00:00Z"), expiresAt: "2027-11-01T10:00:00.000Z" };
    const list = toSessionDtos(
      [
        { ...base, id: "a", updatedAt: "2026-11-10T10:00:00.000Z", userAgent: null },
        { ...base, id: "b", updatedAt: new Date("2026-11-18T10:00:00Z"), userAgent: "Mozilla/5.0 (Windows NT 10.0) Firefox/133.0", ipAddress: "1.2.3.4" },
      ],
      "a",
    );
    expect(list.map((s) => s.id)).toEqual(["b", "a"]);
    expect(list[0]).toMatchObject({ deviceLabel: "Firefox en Windows", isCurrent: false, ipAddress: "1.2.3.4", createdAt: "2026-11-01T10:00:00.000Z" });
    expect(list[1]).toMatchObject({ deviceLabel: "Dispositivo desconocido", isCurrent: true, ipAddress: null });
  });
});
