import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

export interface RequestContextStore {
  requestId: string;
  userId: string | null;
  userName: string | null;
  sessionId: string | null;
  clientMutationId: string | null;
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function getRequestContext(): RequestContextStore | undefined {
  return requestContext.getStore();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseClientMutationId(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const existingId = req.headers['x-request-id'];
  const requestId =
    typeof existingId === 'string' && existingId ? existingId : randomUUID();
  if (!res.getHeader('x-request-id')) res.setHeader('x-request-id', requestId);

  const store: RequestContextStore = {
    requestId,
    userId: null,
    userName: null,
    sessionId: null,
    clientMutationId: parseClientMutationId(req.headers['x-client-mutation-id']),
  };

  requestContext.run(store, () => next());
}
