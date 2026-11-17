import { type ReactNode } from "react";

import logoDark from "@/assets/logo-horizontal-dark.svg";
import logo from "@/assets/logo-horizontal.svg";

export interface AuthLayoutProps {
  title: string;
  children: ReactNode;
  /** Texto bajo el título (p. ej. la invitación pendiente). */
  intro?: ReactNode;
  footer?: ReactNode;
}

/**
 * Pantallas públicas de auth (spec 01 §7): sin `AppHeader` ni `BottomNav`, logo
 * horizontal arriba, una columna y ancho cómodo a 375 px.
 */
export function AuthLayout({ title, intro, children, footer }: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 pb-10 pt-10 text-[var(--ink)]">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <img src={logo} alt="Hogaria" className="logo-light h-10 w-auto" />
          <img src={logoDark} alt="Hogaria" className="logo-dark h-10 w-auto" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="font-sign text-[28px] font-semibold uppercase tracking-[0.04em]">{title}</h1>
          {intro}
        </div>
        {children}
        {footer ? <div className="flex flex-col gap-3 text-[14px] text-[var(--ink-muted)]">{footer}</div> : null}
      </div>
    </main>
  );
}

/** Mensaje de error del formulario (`role="alert"`: lo anuncian los lectores de pantalla). */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-[var(--radius-sm)] border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-[14px] text-[var(--danger)]">
      {children}
    </p>
  );
}

/** Aviso informativo (no es un error). */
export function FormNotice({ children }: { children: ReactNode }) {
  return <p className="rounded-[var(--radius-sm)] bg-[var(--primary-soft)] px-3 py-2 text-[14px] text-[var(--on-primary-soft)]">{children}</p>;
}
