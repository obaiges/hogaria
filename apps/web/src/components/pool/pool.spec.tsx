import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DepthFigure } from "./DepthFigure";
import { Lane } from "./Lane";
import { laneColorVar } from "./lane-colors";
import { LaneRope } from "./LaneRope";
import { getInitials, MemberAvatar, MemberDot } from "./MemberAvatar";
import { useRippleClass } from "./useRippleClass";

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" ? matches : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("laneColorVar", () => {
  it("devuelve la variable CSS del color de calle", () => {
    expect(laneColorVar("CORAL")).toBe("var(--lane-coral)");
    expect(laneColorVar("SLATE")).toBe("var(--lane-slate)");
  });
});

describe("MemberDot / MemberAvatar", () => {
  it("calcula las iniciales", () => {
    expect(getInitials("Ana García")).toBe("AG");
    expect(getInitials("  óscar   baiges  ")).toBe("ÓB");
    expect(getInitials("Lucía")).toBe("L");
    expect(getInitials("")).toBe("?");
  });

  it("muestra las iniciales con el color de calle y nombre accesible", () => {
    render(<MemberDot member={{ name: "Ana García", laneColor: "CORAL" }} />);
    const avatar = screen.getByRole("img", { name: "Ana García" });
    expect(avatar).toHaveTextContent("AG");
    expect(avatar).toHaveStyle({ width: "20px", background: "var(--lane-coral)" });
    expect(avatar).not.toHaveAttribute("data-neutral");
  });

  it("variante neutra sin miembro: 'Usuario eliminado' por defecto", () => {
    render(<MemberAvatar member={null} size={36} />);
    const avatar = screen.getByRole("img", { name: "Usuario eliminado" });
    expect(avatar).toHaveAttribute("data-neutral", "true");
    expect(avatar).toHaveTextContent("");
  });

  it("variante neutra para ex-miembros conserva las iniciales", () => {
    render(<MemberAvatar member={{ name: "Pablo Ruiz", laneColor: null }} />);
    const avatar = screen.getByRole("img", { name: "Pablo Ruiz" });
    expect(avatar).toHaveAttribute("data-neutral", "true");
    expect(avatar).toHaveTextContent("PR");
  });

  it("si la foto falla, vuelve a las iniciales", () => {
    const { container } = render(<MemberAvatar member={{ name: "Ana García", laneColor: "SEA", image: "https://x/y.png" }} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    fireEvent.error(img as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Ana García" })).toHaveTextContent("AG");
  });
});

describe("Lane", () => {
  it("es un grupo con aria-label 'Calle de {nombre}'", () => {
    render(
      <Lane member={{ name: "Ana", laneColor: "CORAL" }}>
        <span>Fregar</span>
      </Lane>,
    );
    const lane = screen.getByRole("group", { name: "Calle de Ana" });
    expect(lane).toHaveTextContent("Fregar");
    expect(lane.style.getPropertyValue("--lane-c")).toBe("var(--lane-coral)");
  });

  it("onPress se dispara una vez desde la fila o desde el botón", () => {
    const onPress = vi.fn();
    render(<Lane member={{ name: "Ana", laneColor: "CORAL" }} onPress={onPress} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir la calle de Ana" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("group", { name: "Calle de Ana" }));
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it("highlight='ripple' aplica la onda con el color del autor", () => {
    render(<Lane member={{ name: "Óscar", laneColor: "SEA" }} highlight="ripple" rippleColor="CORAL" />);
    const lane = screen.getByRole("group", { name: "Calle de Óscar" });
    expect(lane).toHaveClass("ripple");
    expect(lane.style.getPropertyValue("--ripple-color")).toBe("var(--lane-coral)");
  });
});

describe("LaneRope y DepthFigure", () => {
  it("LaneRope es decorativa", () => {
    const { container } = render(<LaneRope variant="limit" />);
    const rope = container.firstElementChild as HTMLElement;
    expect(rope).toHaveAttribute("aria-hidden", "true");
    expect(rope).toHaveAttribute("data-variant", "limit");
  });

  it("DepthFigure usa cifras tabulares y la variante límite en rojo", () => {
    render(<DepthFigure value="64,20 €" label="Luz · vencida ayer" size="l" variant="limit" />);
    const value = screen.getByText("64,20 €");
    expect(value).toHaveClass("tabular-nums", "text-[length:var(--text-depth)]", "text-[var(--rope-red)]");
    expect(screen.getByText("Luz · vencida ayer")).toBeInTheDocument();
  });
});

describe("useRippleClass", () => {
  it("sin activar no aplica nada", () => {
    mockReducedMotion(false);
    const { result } = renderHook(() => useRippleClass(false, "SEA"));
    expect(result.current).toEqual({ className: "", style: undefined });
  });

  it("activa el barrido con el color de calle", () => {
    mockReducedMotion(false);
    const { result } = renderHook(() => useRippleClass(true, "SEA"));
    expect(result.current.className).toBe("ripple");
    expect(result.current.style).toEqual({ "--ripple-color": "var(--lane-sea)" });
  });

  it("respeta prefers-reduced-motion: solo cambio de fondo", () => {
    mockReducedMotion(true);
    const { result } = renderHook(() => useRippleClass(true, "SEA"));
    expect(result.current.className).toBe("ripple ripple-reduced");
    expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("sin color de autor usa --primary", () => {
    mockReducedMotion(false);
    const { result } = renderHook(() => useRippleClass(true, null));
    expect(result.current.style).toEqual({ "--ripple-color": "var(--primary)" });
  });
});
