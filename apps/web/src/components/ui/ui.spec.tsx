import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";
import { Dialog, DialogContent, DialogTrigger } from "./Dialog";
import { ErrorState } from "./ErrorState";
import { FormField } from "./FormField";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { ToastViewport, useToastStore } from "./Toast";

describe("UI base", () => {
  it("Button loading deshabilita", () => {
    render(<Button loading>Guardar</Button>);
    expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
  });

  it("ErrorState llama a onRetry", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Fallo" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("FormField enlaza el error", () => {
    render(<FormField label="Nombre" error="Obligatorio"><Input /></FormField>);
    const input = screen.getByLabelText("Nombre");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const err = screen.getByText("Obligatorio");
    expect(input).toHaveAttribute("aria-describedby", err.id);
  });

  it("FormField con error no apunta a un hint oculto", () => {
    render(<FormField label="Nombre" hint="Ayuda" error="Obligatorio"><Input /></FormField>);
    const input = screen.getByLabelText("Nombre");
    expect(screen.queryByText("Ayuda")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-describedby", screen.getByText("Obligatorio").id);
  });

  it("Dialog atrapa el foco, cierra con Escape y lo devuelve al disparador", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild><Button>Abrir</Button></DialogTrigger>
        <DialogContent title="Título" description="Desc"><button>Dentro</button></DialogContent>
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "Abrir" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Título");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    for (let i = 0; i < 4; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("Toast muestra la acción Deshacer y desaparece a los 5 s", () => {
    vi.useFakeTimers();
    try {
      const onUndo = vi.fn();
      render(<ToastViewport />);
      act(() => useToastStore.getState().add({ message: "Producto borrado", actionLabel: "Deshacer", onAction: onUndo }));
      expect(screen.getByText("Producto borrado").closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
      fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
      expect(onUndo).toHaveBeenCalledOnce();
      expect(screen.queryByText("Producto borrado")).not.toBeInTheDocument();

      act(() => useToastStore.getState().add({ message: "Otro" }));
      expect(screen.getByText("Otro")).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(5000));
      expect(screen.queryByText("Otro")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("Skeleton no pulsa con prefers-reduced-motion", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("motion-safe:animate-pulse");
    expect(el.className).toContain("motion-reduce:animate-none");
  });
});
