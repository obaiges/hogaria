import { useSyncExternalStore, type CSSProperties } from "react";

import { type LaneColor } from "@hogaria/shared";

import { laneColorVar } from "./lane-colors";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function getMediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(REDUCED_MOTION_QUERY);
}

function subscribe(onChange: () => void): () => void {
  const mql = getMediaQuery();
  if (!mql) return () => {};
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getMediaQuery()?.matches ?? false,
    () => false,
  );
}

export interface RippleProps {
  className: string;
  style: CSSProperties | undefined;
}

/**
 * Clase y estilo de la onda para cualquier fila (DESIGN.md §6). Cuándo se activa lo
 * decide el tiempo real (HOG-152); aquí solo la presentación. `laneColor` es el color
 * de calle del autor del cambio.
 */
export function useRippleClass(active: boolean, laneColor?: LaneColor | null): RippleProps {
  const reduced = usePrefersReducedMotion();
  if (!active) return { className: "", style: undefined };
  return {
    className: reduced ? "ripple ripple-reduced" : "ripple",
    style: { "--ripple-color": laneColor ? laneColorVar(laneColor) : "var(--primary)" } as CSSProperties,
  };
}
