import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { redirect } from "react-router";

import { meDto, type MeDto } from "@hogaria/shared";

import { queryClient as appQueryClient } from "@/app/queryClient";
import { api, ApiError } from "@/lib/apiClient";

/** `GET /api/v1/me`, o `null` si no hay sesión (sin redirigir: lo deciden los loaders). */
export async function fetchMe(): Promise<MeDto | null> {
  try {
    return await api.get<MeDto>("/me", { schema: meDto, redirectOn401: false });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

// Sin reintentos: si la API no responde, se informa al momento en vez de dejar la pantalla en blanco.
export const meQuery = queryOptions({ queryKey: ["me"] as const, queryFn: fetchMe, staleTime: 60_000, retry: false });

export function useMe() {
  return useQuery(meQuery);
}

/**
 * `?volver=` solo se respeta si es una ruta interna (spec 01 §7): empieza por `/`, no
 * por `//` y no contiene `://` ni barras invertidas.
 */
export function safeVolver(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("://") || value.includes("\\")) return null;
  return value;
}

/** Destino tras entrar: `?volver=` válido o la redirección de entrada (`/`, HOG-104). */
export function afterSignInPath(search: string): string {
  return safeVolver(new URLSearchParams(search).get("volver")) ?? "/";
}

/** Loader del layout privado: sin sesión → `/entrar?volver=<ruta actual>`. */
export function requireAuthLoader(client: QueryClient = appQueryClient) {
  return async ({ request }: { request: Request }) => {
    const me = await client.ensureQueryData(meQuery);
    if (!me) {
      const url = new URL(request.url);
      throw redirect(`/entrar?volver=${encodeURIComponent(url.pathname + url.search)}`);
    }
    return null;
  };
}

/**
 * Loader de `/entrar` y `/registro`: con sesión → `/` (o `?volver=` válido). Si no se puede
 * comprobar (API caída), se muestra la pantalla igualmente: el propio formulario informará.
 */
export function redirectIfAuthenticatedLoader(client: QueryClient = appQueryClient) {
  return async ({ request }: { request: Request }) => {
    const me = await client.fetchQuery(meQuery).catch(() => null);
    if (me) throw redirect(afterSignInPath(new URL(request.url).search));
    return null;
  };
}
