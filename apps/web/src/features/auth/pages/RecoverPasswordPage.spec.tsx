import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { http, HttpResponse, server } from "@/test/msw";

import { authUrl, renderRoute } from "../test-utils";
import { RecoverPasswordPage, RESET_REQUESTED_MESSAGE } from "./RecoverPasswordPage";

describe("RecoverPasswordPage", () => {
  it("pedir enlace: mensaje genérico aunque la API responda con error", async () => {
    let body: unknown;
    server.use(
      http.post(authUrl("/request-password-reset"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ code: "USER_NOT_FOUND", message: "x" }, { status: 400 });
      }),
    );
    renderRoute(<RecoverPasswordPage />, "/recuperar", "/recuperar");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "Nadie@Demo.local");
    await user.click(screen.getByRole("button", { name: "Enviar enlace" }));
    expect(await screen.findByText(RESET_REQUESTED_MESSAGE)).toBeInTheDocument();
    expect(body).toMatchObject({ email: "nadie@demo.local", redirectTo: `${window.location.origin}/recuperar` });
  });

  it("con ?token: guarda la nueva contraseña", async () => {
    let body: unknown;
    server.use(
      http.post(authUrl("/reset-password"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ status: true });
      }),
    );
    renderRoute(<RecoverPasswordPage />, "/recuperar", "/recuperar?token=abc");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nueva contraseña"), "piscina-azul-2026");
    await user.type(screen.getByLabelText("Repite la contraseña"), "piscina-azul-2026");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(await screen.findByText("Contraseña cambiada. Ya puedes entrar.")).toBeInTheDocument();
    expect(body).toMatchObject({ newPassword: "piscina-azul-2026", token: "abc" });
  });

  it("token rechazado o ?error=INVALID_TOKEN → 'El enlace no es válido o ha caducado.'", async () => {
    server.use(http.post(authUrl("/reset-password"), () => HttpResponse.json({ code: "INVALID_TOKEN", message: "x" }, { status: 400 })));
    renderRoute(<RecoverPasswordPage />, "/recuperar", "/recuperar?token=viejo");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nueva contraseña"), "piscina-azul-2026");
    await user.type(screen.getByLabelText("Repite la contraseña"), "piscina-azul-2026");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(await screen.findByText("El enlace no es válido o ha caducado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pedir otro enlace" })).toBeInTheDocument();
  });
});
