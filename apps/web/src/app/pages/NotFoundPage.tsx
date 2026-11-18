import { useNavigate } from "react-router";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";

export const NOT_FOUND_PAGE_TEXT = {
  title: "No encontrado",
  body: "Este hogar o esta página no existe, o no tienes acceso.",
  action: "Ir al inicio",
} as const;

export interface NotFoundPageProps {
  body?: string;
  action?: string;
  to?: string;
}

/**
 * "No encontrado" (spec 15 §7.1). Dentro del shell, sin barra inferior. Nunca distingue
 * "no existe" de "no tienes acceso" (RN-15-08). Sin "Reintentar".
 */
export function NotFoundPage({ body = NOT_FOUND_PAGE_TEXT.body, action = NOT_FOUND_PAGE_TEXT.action, to = "/" }: NotFoundPageProps) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 pt-10">
      <h1 className="text-center font-sign text-[28px] font-semibold uppercase tracking-[0.04em] text-[var(--ink)]">
        {NOT_FOUND_PAGE_TEXT.title}
      </h1>
      <ErrorState message={body} />
      <Button onClick={() => void navigate(to)}>{action}</Button>
    </div>
  );
}

/** `*`: ruta desconocida, fuera del shell (también sin sesión). */
export function UnknownRoutePage() {
  return (
    <main id="contenido" className="min-h-screen bg-[var(--bg)]">
      <NotFoundPage />
    </main>
  );
}
