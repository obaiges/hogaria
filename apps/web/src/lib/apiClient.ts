import { ERROR_MESSAGES_ES, isErrorCode, problemDetailsSchema, type ProblemDetails } from '@hogaria/shared';

import { useToastStore } from '@/components/ui/Toast';

import { getConnectionStatus, OFFLINE_MESSAGE } from './realtime/connection-store';
import { registerMutation } from './realtime/mutation-registry';

export interface ProblemFieldError {
  path: string;
  message: string;
}

const API_BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

export class ApiError extends Error {
  status: number;
  code: string | null;
  detail?: string;
  errors?: ProblemFieldError[];
  problem?: ProblemDetails;

  constructor(status: number, problem?: Partial<ProblemDetails> & { code?: string; detail?: string; errors?: ProblemFieldError[] }) {
    const code = problem?.code ?? null;
    const msg = isErrorCode(code) ? ERROR_MESSAGES_ES[code] : ERROR_MESSAGES_ES.INTERNAL;
    super(msg);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = problem?.detail;
    this.errors = problem?.errors;
    this.problem = problem as ProblemDetails | undefined;
  }
}

export class NetworkError extends Error {
  constructor() {
    super('No hay conexión con el servidor');
    this.name = 'NetworkError';
  }
}

/** Mutación rechazada sin enviarla porque no hay conexión (RN-03-23). */
export class OfflineError extends Error {
  constructor() {
    super(OFFLINE_MESSAGE);
    this.name = 'OfflineError';
  }
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type SchemaLike<T> = { parse: (data: unknown) => T };

interface RequestOptions<T> {
  body?: unknown;
  schema?: SchemaLike<T>;
  headers?: Record<string, string>;
  /** Por defecto, un 401 lleva a `/entrar?volver=…`. `false`: solo lanza `ApiError(401)` (p. ej. comprobar la sesión en un loader). */
  redirectOn401?: boolean;
}

function isMutation(method: HttpMethod) {
  return method !== 'GET';
}

function clearClientState() {
  try {
    // TanStack Query cache clearing handled by consumer; clear storage hints
    localStorage.removeItem('hogaria-auth');
  } catch {
    // ignore
  }
}

async function parseProblem(res: Response): Promise<Partial<ProblemDetails> | undefined> {
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) return undefined;
  try {
    const data = await res.json();
    const parsed = problemDetailsSchema.safeParse(data);
    return parsed.success ? parsed.data : data;
  } catch {
    return undefined;
  }
}

async function request<T>(method: HttpMethod, path: string, opts: RequestOptions<T> = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };

  if (isMutation(method) && getConnectionStatus() === 'offline') {
    // Nunca se encola ni se envía: se avisa y se rechaza (ADR-015).
    useToastStore.getState().add({ message: OFFLINE_MESSAGE });
    throw new OfflineError();
  }
  if (isMutation(method)) {
    const id = crypto.randomUUID();
    registerMutation(id);
    headers['X-Client-Mutation-Id'] = id;
  }
  if (opts.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new NetworkError();
  }

  if (res.status === 401) {
    if (opts.redirectOn401 === false) throw new ApiError(401, { code: 'UNAUTHENTICATED' });
    clearClientState();
    const volver = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`/entrar?volver=${volver}`);
    throw new ApiError(401, { code: 'UNAUTHENTICATED' });
  }

  if (!res.ok) {
    const problem = await parseProblem(res);
    throw new ApiError(res.status, problem);
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('json') ? await res.json() : ((await res.text()) as unknown);
  if (opts.schema && import.meta.env.DEV) {
    return opts.schema.parse(data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions<T>, 'body'>) => request<T>('GET', path, opts),
  post: <T>(path: string, opts?: RequestOptions<T>) => request<T>('POST', path, opts),
  patch: <T>(path: string, opts?: RequestOptions<T>) => request<T>('PATCH', path, opts),
  put: <T>(path: string, opts?: RequestOptions<T>) => request<T>('PUT', path, opts),
  delete: <T>(path: string, opts?: RequestOptions<T>) => request<T>('DELETE', path, opts),
};
