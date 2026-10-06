import { createHash, timingSafeEqual } from 'node:crypto';
import { type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { Request } from 'express';
import { rateLimited } from '../auth/auth-errors';
import { IS_PUBLIC } from '../auth/decorators';
import { APP_CONFIG, type AppConfig } from '../config/config';
import { clientIp } from './client';

/** Sent with STOREFRONT_API_KEY by the storefront's own server on its catalogue reads (@hb/sdk). */
export const STOREFRONT_KEY_HEADER = 'x-hb-storefront-key';

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest();

/**
 * Per-IP rate limits (security.md). Tracks the same client IP the rest of the API uses
 * (Express `req.ip` under TRUST_PROXY) and answers 429 RATE_LIMITED with details.retryAfterSec.
 */
@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  private readonly storefrontKey: Buffer | null;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    @Inject(Reflector) reflector: Reflector,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    super(options, storage, reflector);
    this.storefrontKey = config.storefrontKey === null ? null : sha256(config.storefrontKey);
  }

  /**
   * The storefront renders every shopper's pages on its own server, so its server-side reads all
   * come from one IP: counted per IP, one busy minute would rate-limit the whole site. Public GETs
   * that carry the storefront key are therefore not counted here; the edge limits each shopper
   * before they reach the storefront (security.md §11). Writes and signed-in routes always count.
   */
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (this.storefrontKey === null || context.getType() !== 'http') return false;
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    const targets = [context.getHandler(), context.getClass()];
    if (!this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return false;
    const key = req.get(STOREFRONT_KEY_HEADER);
    // Digests have a fixed length, so the comparison time says nothing about the key.
    return key !== undefined && timingSafeEqual(sha256(key), this.storefrontKey);
  }

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
