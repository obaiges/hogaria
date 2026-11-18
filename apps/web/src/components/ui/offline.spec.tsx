import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { resetConnectionStore, setBrowserOnline, socketConnected, socketConnecting, socketDisconnected } from "@/lib/realtime/connection-store";

import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { OfflineBanner } from "./OfflineBanner";

const MESSAGE = "Sin conexión. Los cambios no se guardarán";

afterEach(() => {
  resetConnectionStore();
});

describe("OfflineBanner", () => {
  it("solo se ve en offline (no en reconnecting) y es una región status", () => {
    render(<OfflineBanner />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByText(MESSAGE)).toBeNull();

    act(() => {
      socketConnecting();
      socketConnected();
      socketDisconnected();
    });
    expect(screen.queryByText(MESSAGE)).toBeNull(); // reconnecting

    act(() => setBrowserOnline(false));
    expect(region).toHaveTextContent(MESSAGE);

    act(() => setBrowserOnline(true));
    act(() => socketConnected());
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });
});

describe("requiresConnection", () => {
  it("Button se deshabilita sin conexión con aria-disabled y title", () => {
    render(
      <>
        <Button requiresConnection>Guardar</Button>
        <Button>Cancelar</Button>
      </>,
    );
    const save = screen.getByRole("button", { name: "Guardar" });
    expect(save).toBeEnabled();

    act(() => setBrowserOnline(false));
    expect(save).toBeDisabled();
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveAttribute("title", "Sin conexión");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();

    act(() => setBrowserOnline(true));
    expect(save).toBeEnabled();
    expect(save).not.toHaveAttribute("title");
  });

  it("Checkbox se deshabilita sin conexión", () => {
    render(<Checkbox requiresConnection aria-label="Comprado" />);
    act(() => setBrowserOnline(false));
    const box = screen.getByRole("checkbox", { name: "Comprado" });
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute("title", "Sin conexión");
  });
});
