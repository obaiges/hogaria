import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ZodError } from 'zod';

import {
  ERROR_MESSAGES_ES,
  ERROR_STATUS,
  ERROR_TITLES_ES,
  problemTypeFor,
  type ErrorCode,
} from '@hogaria/shared';

import { AppError } from '../errors/app-error.js';

const PROBLEM_CONTENT_TYPE = 'application/problem+json';

function zodIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join('.') : '',
    message: issue.message,
  }));
}

function buildProblem(
  code: ErrorCode,
  status: number,
  detail?: string,
  errors?: Array<{ path: string; message: string }>,
  extensions?: Record<string, unknown>,
) {
  const body: Record<string, unknown> = {
    type: problemTypeFor(code),
    title: ERROR_TITLES_ES[code],
    status,
    code,
  };
  if (detail) body.detail = detail;
  if (errors && errors.length) body.errors = errors;
  if (extensions) Object.assign(body, extensions);
  return body;
}

function fromHttpException(exception: HttpException): { status: number; body: Record<string, unknown>; headers?: Record<string, string> } {
  const status = exception.getStatus();
  const raw = exception.getResponse();
  const res = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : undefined;

  if (status === 429) {
    const hdrs = res?.headers as Record<string, unknown> | undefined;
    const retryAfter = hdrs?.['Retry-After'] ?? hdrs?.['retry-after'] ?? res?.['Retry-After'];
    const headers: Record<string, string> = {};
    if (retryAfter != null) headers['Retry-After'] = String(retryAfter);
    return { status, body: buildProblem('RATE_LIMITED', 429, ERROR_MESSAGES_ES.RATE_LIMITED), headers };
  }

  if (res && typeof res.code === 'string' && typeof res.status === 'number' && typeof res.type === 'string') {
    return { status: res.status as number, body: res };
  }

  if (res && 'status' in res && !('code' in res) && !('type' in res)) {
    return { status, body: res };
  }

  if (status === 400 || status === 422) {
    const msgs = Array.isArray(res?.message) ? (res.message as string[]) : undefined;
    const errors = msgs?.map((m) => ({ path: '', message: String(m) }));
    return {
      status: 422,
      body: buildProblem('VALIDATION_ERROR', 422, ERROR_MESSAGES_ES.VALIDATION_ERROR, errors),
    };
  }

  const code: ErrorCode =
    status === 401 ? 'UNAUTHENTICATED'
    : status === 403 ? 'FORBIDDEN_NOT_OWNER'
    : status === 404 ? 'NOT_FOUND'
    : status === 409 ? 'CONFLICT'
    : status === 503 ? 'AI_UNAVAILABLE'
    : 'INTERNAL';
  const safeStatus = ERROR_STATUS[code] ?? status;
  const detail =
    typeof res?.message === 'string' && safeStatus !== 500 ? (res.message as string)
    : typeof raw === 'string' && safeStatus !== 500 ? raw
    : undefined;
  return { status: safeStatus, body: buildProblem(code, safeStatus, detail) };
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown>;
    let headers: Record<string, string> | undefined;

    if (exception instanceof AppError) {
      status = exception.status;
      body = buildProblem(exception.code, status, exception.detail, exception.errors, exception.extensions);
    } else if (exception instanceof ZodError) {
      status = 422;
      body = buildProblem('VALIDATION_ERROR', 422, ERROR_MESSAGES_ES.VALIDATION_ERROR, zodIssues(exception));
    } else if (exception instanceof HttpException) {
      const mapped = fromHttpException(exception);
      status = mapped.status;
      body = mapped.body;
      headers = mapped.headers;
    } else {
      status = 500;
      body = buildProblem('INTERNAL', 500);
    }

    if (headers) {
      for (const [k, v] of Object.entries(headers)) httpAdapter.setHeader(response, k, v);
    }
    httpAdapter.setHeader(response, 'Content-Type', PROBLEM_CONTENT_TYPE);
    httpAdapter.reply(response, body, status);
  }
}
