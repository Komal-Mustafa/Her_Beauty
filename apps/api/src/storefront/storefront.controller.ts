import { Controller, Get, Inject, Query, Res } from '@nestjs/common';
import { FEATURED_REVIEWS_DEFAULT, FeaturedReviewQuery } from '@hb/types';
import type { Response } from 'express';
import { Public } from '../auth/decorators';
import { coerceQuery, parse } from '../common/validate';
import { StorefrontService } from './storefront.service';

/** Counters change slowly; shared caches may keep them for 5 minutes (docs/p4-home.md §6). */
const STATS_CACHE_CONTROL = 'public, max-age=300';

/**
 * Public home page highlights (no account needed). Registered before CatalogController in
 * AppModule so the literal `brands/featured` wins over `brands/:slug`.
 */
@Public()
@Controller()
export class StorefrontController {
  constructor(@Inject(StorefrontService) private readonly storefront: StorefrontService) {}

  @Get('stats/storefront')
  async stats(@Res({ passthrough: true }) res: Response) {
    const stats = await this.storefront.stats();
    // Set only on success, so an error response is never cached.
    res.setHeader('Cache-Control', STATS_CACHE_CONTROL);
    return stats;
  }

  @Get('reviews/featured')
  featuredReviews(@Query() raw: Record<string, unknown>) {
    const { limit } = parse(FeaturedReviewQuery.strict(), coerceQuery(raw, { numbers: ['limit'] }));
    return this.storefront.featuredReviews(limit ?? FEATURED_REVIEWS_DEFAULT);
  }

  @Get('brands/featured')
  featuredBrands() {
    return this.storefront.featuredBrands();
  }
}
