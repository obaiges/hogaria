import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface DepthFigureProps {
  /** Cifra ya formateada (p. ej. `formatCents`), o un número. */
  value: ReactNode;
  label: string;
  size?: "s" | "l";
  /** Cifra en rojo corchera: importe superado o vencido. Acompáñalo de texto en `label`. */
  variant?: "limit";
  className?: string;
}

/** Cifra de profundidad (DESIGN.md §7): número clave rotulado con etiqueta en mayúsculas. */
export function DepthFigure({ value, label, size = "s", variant, className }: DepthFigureProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span
        className={cn(
          "font-sign font-semibold leading-none tabular-nums",
          // `length:` para que tailwind-merge no lo confunda con el color de texto.
          size === "l" ? "text-[length:var(--text-depth)]" : "text-[length:var(--text-2xl)]",
          variant === "limit" ? "text-[var(--rope-red)]" : "text-[var(--ink)]",
        )}
      >
        {value}
      </span>
      <span className="font-sign text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">{label}</span>
    </div>
  );
}
