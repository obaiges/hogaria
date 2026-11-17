import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TOAST_DURATION_MS, ToastViewport, useToastStore } from "@/components/ui/Toast";

import { UPDATE_MESSAGE, UpdatePrompt } from "./UpdatePrompt";

const pwa = vi.hoisted(() => ({
  needRefresh: false,
  updateServiceWorker: vi.fn(() => Promise.resolve()),
}));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [pwa.needRefresh, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: pwa.updateServiceWorker,
  }),
}));

describe("UpdatePrompt", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    pwa.updateServiceWorker.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("no muestra nada sin versión nueva", () => {
    pwa.needRefresh = false;
    render(
      <>
        <UpdatePrompt />
        <ToastViewport />
      </>,
    );
    expect(screen.queryByText(UPDATE_MESSAGE)).not.toBeInTheDocument();
  });

  it("con needRefresh = true muestra un toast persistente y 'Actualizar' llama a updateSW(true)", () => {
    vi.useFakeTimers();
    pwa.needRefresh = true;
    const { rerender } = render(
      <>
        <UpdatePrompt />
        <ToastViewport />
      </>,
    );
    expect(screen.getByText(UPDATE_MESSAGE)).toBeInTheDocument();

    // Persistente: sigue ahí pasado el tiempo normal de un toast, y no se duplica al repintar.
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS * 3));
    rerender(
      <>
        <UpdatePrompt />
        <ToastViewport />
      </>,
    );
    expect(screen.getAllByText(UPDATE_MESSAGE)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(pwa.updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
