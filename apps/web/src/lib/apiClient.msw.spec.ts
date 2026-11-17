import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { apiUrl, http, HttpResponse, server } from "@/test/msw";

import { api, ApiError, NetworkError } from "./apiClient";

// Test de humo de MSW (HOG-010): el apiClient real contra respuestas simuladas por red.
describe("apiClient con MSW", () => {
  it("GET devuelve el JSON y lo valida con el schema", async () => {
    server.use(http.get(apiUrl("/groups"), () => HttpResponse.json([{ id: "g1", name: "Casa Baiges" }])));
    const schema = z.array(z.object({ id: z.string(), name: z.string() }));
    await expect(api.get("/groups", { schema })).resolves.toEqual([{ id: "g1", name: "Casa Baiges" }]);
  });

  it("las mutaciones envían cookies y X-Client-Mutation-Id", async () => {
    let mutationId: string | null = null;
    let body: unknown;
    server.use(
      http.post(apiUrl("/groups"), async ({ request }) => {
        mutationId = request.headers.get("X-Client-Mutation-Id");
        body = await request.json();
        return HttpResponse.json({ id: "g2" }, { status: 201 });
      }),
    );
    await expect(api.post("/groups", { body: { name: "Piso" } })).resolves.toEqual({ id: "g2" });
    expect(mutationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body).toEqual({ name: "Piso" });
  });

  it("traduce problem+json a ApiError", async () => {
    server.use(
      http.get(apiUrl("/groups/x"), () =>
        HttpResponse.json(
          { type: "https://hogaria/errors/not-found", title: "No encontrado", status: 404, code: "NOT_FOUND" },
          { status: 404, headers: { "content-type": "application/problem+json" } },
        ),
      ),
    );
    await expect(api.get("/groups/x")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND", message: "No encontrado" });
    await expect(api.get("/groups/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("una petición sin respuesta definida falla (onUnhandledFrame: 'error')", async () => {
    const silenced = vi.spyOn(globalThis.console, "error").mockImplementation(() => {});
    try {
      await expect(api.get("/sin-manejar")).rejects.toBeInstanceOf(NetworkError);
    } finally {
      silenced.mockRestore();
    }
  });
});
