import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { http, HttpResponse, server } from "@/test/msw";

import { authUrl, renderRoute } from "../test-utils";
import { PENDING_INVITE_KEY, SignUpPage } from "./SignUpPage";

async function fillForm(overrides: Partial<Record<string, string>> = {}) {
  const v = { name: "Ana", email: "ana@demo.local", username: "ana_g", password: "piscina-azul-2026", repeat: "piscina-azul-2026", ...overrides };
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nombre"), v.name);
  await user.type(screen.getByLabelText("Email"), v.email);
  await user.type(screen.getByLabelText("Nombre de usuario"), v.username);
  await user.type(screen.getByLabelText("Contraseña"), v.password);
  await user.type(screen.getByLabelText("Repite la contraseña"), v.repeat);
  await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
}

describe("SignUpPage", () => {
  afterEach(() => sessionStorage.clear());

  it("contraseñas distintas → 'Las contraseñas no coinciden' sin llamar a la API", async () => {
    renderRoute(<SignUpPage />, "/registro", "/registro");
    await fillForm({ repeat: "otra-cosa-distinta" });
    expect(await screen.findByText("Las contraseñas no coinciden")).toBeInTheDocument();
    expect(screen.getByLabelText("Repite la contraseña")).toHaveFocus();
  });

  it("contraseña común → mensaje de la política", async () => {
    renderRoute(<SignUpPage />, "/registro", "/registro");
    await fillForm({ password: "1234567890", repeat: "1234567890" });
    expect(await screen.findByText("Esa contraseña es demasiado común. Elige otra")).toBeInTheDocument();
  });

  it("éxito → estado 'Revisa tu email' con reenvío bloqueado 60 s y se borra la invitación pendiente", async () => {
    sessionStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({ token: "t", groupName: "Casa Baiges", groupEmoji: "🏡" }));
    let body: unknown;
    server.use(
      http.post(authUrl("/sign-up/email"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ token: null, user: { id: "u1" } });
      }),
    );
    renderRoute(<SignUpPage />, "/registro", "/registro");
    expect(screen.getByText("Crea tu cuenta para unirte a 🏡 Casa Baiges")).toBeInTheDocument();
    await fillForm();

    expect(await screen.findByText("Te hemos enviado un enlace a ana@demo.local. Ábrelo para activar tu cuenta.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reenviar en \d+ s/ })).toBeDisabled();
    expect(body).toMatchObject({ name: "Ana", email: "ana@demo.local", username: "ana_g", callbackURL: `${window.location.origin}/` });
    expect(sessionStorage.getItem(PENDING_INVITE_KEY)).toBeNull();
  });

  it("sin invitación muestra el aviso; username ocupado → error en el campo", async () => {
    server.use(http.post(authUrl("/sign-up/email"), () => HttpResponse.json({ code: "USERNAME_IS_ALREADY_TAKEN", message: "x" }, { status: 422 })));
    renderRoute(<SignUpPage />, "/registro", "/registro");
    expect(screen.getByText("Hogaria es solo por invitación. Si te han invitado, abre el enlace que te enviaron.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(); // sin caja de error vacía
    await fillForm();
    expect(await screen.findByText("Ese nombre de usuario ya existe")).toBeInTheDocument();
  });

  it("invitación requerida → mensaje de la spec", async () => {
    server.use(http.post(authUrl("/sign-up/email"), () => HttpResponse.json({ code: "INVITE_REQUIRED", message: "x" }, { status: 403 })));
    renderRoute(<SignUpPage />, "/registro", "/registro");
    await fillForm();
    expect(await screen.findByRole("alert")).toHaveTextContent("Necesitas una invitación para registrarte.");
  });

  it("invitación requerida con una invitación pendiente → aviso de caducada y botón a /invite/:token", async () => {
    sessionStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({ token: "tok-123", groupName: "Casa", groupEmoji: "🐶" }));
    server.use(http.post(authUrl("/sign-up/email"), () => HttpResponse.json({ code: "INVITE_REQUIRED", message: "x" }, { status: 403 })));
    renderRoute(<SignUpPage />, "/registro", "/registro");
    await fillForm();
    expect(await screen.findByText("Tu invitación ha caducado en este navegador. Vuelve a abrir el enlace.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Abrir la invitación" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/invite/tok-123");
  });
});
