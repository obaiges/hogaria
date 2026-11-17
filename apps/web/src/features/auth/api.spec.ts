import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { apiUrl, http, HttpResponse, server } from "@/test/msw";

import { afterSignInPath, redirectIfAuthenticatedLoader, requireAuthLoader, safeVolver } from "./api";

const me = {
  id: "0190f3c4-0000-7000-8000-000000000001",
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
  createdAt: "2026-11-17T10:00:00.000Z",
};

async function thrownResponse(fn: () => Promise<unknown>): Promise<Response | null> {
  try {
    await fn();
    return null;
  } catch (thrown) {
    return thrown as Response;
  }
}

describe("safeVolver (spec 01 §7)", () => {
  it.each([["/g/1/tareas"], ["/grupos?x=1"]])("acepta %s", (v) => expect(safeVolver(v)).toBe(v));
  it.each([["//evil.example"], ["https://evil.example"], ["/x?y=https://evil"], ["/\\evil"], ["grupos"], [""], [null]])("rechaza %s", (v) =>
    expect(safeVolver(v)).toBeNull(),
  );
  it("afterSignInPath cae en / si no hay volver válido", () => {
    expect(afterSignInPath("?volver=%2Fperfil")).toBe("/perfil");
    expect(afterSignInPath("?volver=%2F%2Fevil")).toBe("/");
  });
});

describe("loaders de sesión", () => {
  const request = (url: string) => new Request(`http://localhost${url}`);

  it("requireAuth: sin sesión → /entrar?volver=<ruta actual>", async () => {
    server.use(http.get(apiUrl("/me"), () => HttpResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 })));
    const res = await thrownResponse(() => requireAuthLoader(new QueryClient())({ request: request("/g/1/tareas?vista=mias") }));
    expect(res?.status).toBe(302);
    expect(res?.headers.get("Location")).toBe("/entrar?volver=%2Fg%2F1%2Ftareas%3Fvista%3Dmias");
  });

  it("requireAuth: con sesión deja pasar", async () => {
    server.use(http.get(apiUrl("/me"), () => HttpResponse.json(me)));
    await expect(requireAuthLoader(new QueryClient())({ request: request("/grupos") })).resolves.toBeNull();
  });

  it("/entrar con sesión → / (o ?volver= válido)", async () => {
    server.use(http.get(apiUrl("/me"), () => HttpResponse.json(me)));
    const res = await thrownResponse(() => redirectIfAuthenticatedLoader(new QueryClient())({ request: request("/entrar?volver=%2Fperfil") }));
    expect(res?.headers.get("Location")).toBe("/perfil");
  });

  it("/entrar sin sesión se muestra", async () => {
    server.use(http.get(apiUrl("/me"), () => HttpResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 })));
    await expect(redirectIfAuthenticatedLoader(new QueryClient())({ request: request("/entrar") })).resolves.toBeNull();
  });
});
