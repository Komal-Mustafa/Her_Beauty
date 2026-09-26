import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/** Error body shape from 02-trd §5: { error: { code, message, details } }. */
export type ApiErrorBody = { error: { code: string; message: string; details: unknown } };

export class ApiError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, details: unknown = {}) {
    super({ error: { code, message, details } } satisfies ApiErrorBody, status);
  }
}

export const notFound = (what: string) =>
  new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', `${what} not found`);

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
};

/** Every error leaves the API in the same shape, and internals never leak (security.md). */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('ApiError');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'error' in body) {
        res.status(status).json(body);
        return;
      }
      res.status(status).json({
        error: {
          code: CODE_BY_STATUS[status] ?? 'HTTP_ERROR',
          message: exception.message,
          details: {},
        },
      } satisfies ApiErrorBody);
      return;
    }
    this.log.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'INTERNAL', message: 'Something went wrong on our side.', details: {} },
    } satisfies ApiErrorBody);
  }
}
