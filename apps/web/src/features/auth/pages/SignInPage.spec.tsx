import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { http, HttpResponse, server } from "@/test/msw";

import { authUrl, renderRoute } from "../test-utils";
import { SignInPage } from "./SignInPage";

const ok = () => HttpResponse.json({ redirect: false, token: "t", user: { id: "u1" } });

async function fill(identifier: string, password = "contraseña-larga") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email o nombre de usuario"), identifier);
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("SignInPage", () => {
  it("con @ llama a /sign-in/email y vuelve a ?volver=", async () => {
    let body: unknown;
    server.use(
      http.post(authUrl("/sign-in/email"), async ({ request }) => {
        body = await request.json();
        return ok();
      }),
    );
    renderRoute(<SignInPage />, "/entrar", "/entrar?volver=%2Fg%2F1%2Ftareas");
    await fill("Ana@Demo.local");
    expect(await screen.findByTestId("where")).toHaveTextContent("/g/1/tareas");
    expect(body).toMatchObject({ email: "Ana@Demo.local", password: "contraseña-larga" });
  });

  it("sin @ llama a /sign-in/username con el usuario en minúsculas", async () => {
    let body: unknown;
    server.use(
      http.post(authUrl("/sign-in/username"), async ({ request }) => {
        body = await request.json();
        return ok();
      }),
    );
    renderRoute(<SignInPage />, "/entrar", "/entrar");
    await fill("Ana_G");
    expect(await screen.findByTestId("where")).toHaveTextContent("/");
    expect(body).toMatchObject({ username: "ana_g" });
  });

  it("un ?volver= externo se ignora", async () => {
    server.use(http.post(authUrl("/sign-in/email"), ok));
    renderRoute(<SignInPage />, "/entrar", "/entrar?volver=%2F%2Fevil.example");
    await fill("ana@demo.local");
    expect(await screen.findByTestId("where")).toHaveTextContent(/^\/$/);
  });

  it("credenciales incorrectas → mensaje genérico", async () => {
    server.use(http.post(authUrl("/sign-in/username"), () => HttpResponse.json({ code: "INVALID_USERNAME_OR_PASSWORD", message: "x" }, { status: 401 })));
    renderRoute(<SignInPage />, "/entrar", "/entrar");
    await fill("ana");
    expect(await screen.findByRole("alert")).toHaveTextContent("Email, usuario o contraseña incorrectos");
  });

  it("demasiados intentos → minutos desde Retry-After; cuenta bloqueada", async () => {
    server.use(
      http.post(authUrl("/sign-in/email"), () =>
        HttpResponse.json({ code: "RATE_LIMITED", message: "x" }, { status: 429, headers: { "Retry-After": "90" } }),
      ),
    );
    renderRoute(<SignInPage />, "/entrar", "/entrar");
    await fill("ana@demo.local");
    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiados intentos. Vuelve a intentarlo en 2 min.");

    server.use(http.post(authUrl("/sign-in/email"), () => HttpResponse.json({ code: "ACCOUNT_BLOCKED", message: "x" }, { status: 403 })));
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Tu cuenta está bloqueada. Habla con el administrador."));
  });

  it("campos vacíos: errores en los campos, foco en el primero y ninguna petición", async () => {
    renderRoute(<SignInPage />, "/entrar", "/entrar");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Escribe tu email o tu nombre de usuario")).toBeInTheDocument();
    expect(screen.getByLabelText("Email o nombre de usuario")).toHaveFocus();
  });

  it("muestra el error de vuelta de Google (?error=INVITE_REQUIRED) y el aviso de cuenta borrada", () => {
    renderRoute(<SignInPage />, "/entrar", "/entrar?error=INVITE_REQUIRED&cuenta=borrada");
    expect(screen.getByRole("alert")).toHaveTextContent("Necesitas una invitación para crear una cuenta.");
    expect(screen.getByText("Tu cuenta se ha borrado. ¡Gracias por usar Hogaria!")).toBeInTheDocument();
  });

  it("botón de mostrar contraseña", () => {
    renderRoute(<SignInPage />, "/entrar", "/entrar");
    const input = screen.getByLabelText("Contraseña");
    expect(input).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(input).toHaveAttribute("type", "text");
  });
});
