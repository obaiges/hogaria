import { ERROR_MESSAGES_ES, ERROR_STATUS, problemTypeFor, type ErrorCode } from '@hogaria/shared';

/** Error de aplicación con código canónico, convertido a RFC 9457 por el filtro global. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly detail?: string;
  readonly errors?: Array<{ path: string; message: string }>;
  readonly extensions: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    detail?: string,
    errors?: Array<{ path: string; message: string }>,
    extensions?: Record<string, unknown>,
  ) {
    super(detail ?? ERROR_MESSAGES_ES[code]);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.detail = detail;
    this.errors = errors;
    this.extensions = extensions ?? {};
  }

  get type(): string {
    return problemTypeFor(this.code);
  }
}
