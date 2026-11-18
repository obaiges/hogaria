import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { redirect } from "react-router";

import { describeUserAgent, meDto, type MeDto, type SessionDto } from "@hogaria/shared";

import { queryClient as appQueryClient } from "@/app/queryClient";
import { api, ApiError } from "@/lib/apiClient";
import { authClient } from "@/lib/authClient";

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

/** `/entrar?sesion=cerrada`: aviso tras `session.revoked` (spec 01 §5). */
export const SESSION_ENDED_PARAM = "sesion=cerrada";
export const SESSION_ENDED_MESSAGE = "Se ha cerrado tu sesión en este dispositivo";

/** Lo que devuelve Better Auth por sesión en `list-sessions` (fechas como `Date` o ISO). */
export interface RawSession {
  id: string;
  token: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  expiresAt: Date | string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const toIso = (value: Date | string) => new Date(value).toISOString();

/** `sessionDto` (spec 01 §5) ordenado por `updatedAt` desc. */
export function toSessionDtos(sessions: RawSession[], currentSessionId: string | null): SessionDto[] {
  return sessions
    .map((s) => ({
      id: s.id,
      token: s.token,
      createdAt: toIso(s.createdAt),
      updatedAt: toIso(s.updatedAt),
      expiresAt: toIso(s.expiresAt),
      ipAddress: s.ipAddress ?? null,
      userAgent: s.userAgent ?? null,
      deviceLabel: describeUserAgent(s.userAgent),
      isCurrent: s.id === currentSessionId,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function fetchSessions(): Promise<SessionDto[]> {
  const [list, current] = await Promise.all([authClient.listSessions(), authClient.getSession()]);
  if (list.error) throw new Error(list.error.message ?? "No se han podido cargar tus dispositivos");
  return toSessionDtos((list.data ?? []) as RawSession[], current.data?.session.id ?? null);
}

export const sessionsQueryKey = ["me", "sessions"] as const;

export function useSessions() {
  return useQuery({ queryKey: sessionsQueryKey, queryFn: fetchSessions, retry: false });
}
