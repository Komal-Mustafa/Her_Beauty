import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Request } from 'express';
import { rateLimited } from '../auth/auth-errors';
import { clientIp } from './client';

/**
 * Per-IP rate limits (security.md). Tracks the same client IP the rest of the API uses
 * (Express `req.ip` under TRUST_PROXY) and answers 429 RATE_LIMITED with details.retryAfterSec.
 */
@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    return clientIp(req as unknown as Request) ?? 'unknown';
  }

  protected override async throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw rateLimited(Math.max(1, detail.timeToBlockExpire || detail.timeToExpire));
  }
}
