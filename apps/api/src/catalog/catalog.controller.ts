import { Controller, type ExecutionContext, Get, Inject, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Id, PkCity, ProductQuery, SearchQuery, Slug } from '@hb/types';
import type { Request } from 'express';
import { z } from 'zod';
import { DEFAULT_PER_MINUTE, Public } from '../auth/decorators';
import { coerceQuery, parse } from '../common/validate';
import { CatalogService } from './catalog.service';

/** security.md §11: search is limited per IP. */
const SEARCH_PER_MINUTE = 60;

/**
 * One search allowance per IP for every request that runs the typo-tolerant search: all of
 * GET /search, and GET /products with `q` (docs/p5-catalog.md §3.3: the same matcher over the same
 * scan of live products). Other requests to the route keep the global limit and their own count.
 * The storefront's keyed reads are not counted at all (ApiThrottlerGuard).
 */
function SearchLimit(runsSearch: (req: Request) => boolean = () => true) {
  const searching = (context: ExecutionContext) =>
    runsSearch(context.switchToHttp().getRequest<Request>());
  return Throttle({
    default: {
      ttl: 60_000,
      limit: (context) => (searching(context) ? SEARCH_PER_MINUTE : DEFAULT_PER_MINUTE),
      generateKey: (context, tracker, name) =>
        searching(context)
          ? `search-${name}-${tracker}`
          : `${context.getClass().name}-${context.getHandler().name}-${name}-${tracker}`,
    },
  });
}

/** A /products request with a text query (any non-empty `q`, valid or not: it is counted first). */
const hasTextQuery = (req: Request) => {
  const q = req.query['q'];
  return Array.isArray(q) ? q.length > 0 : typeof q === 'string' && q.length > 0;
};

/** Query-string types shared by GET /products and GET /search (docs/p5-catalog.md §3.3). */
const LIST_COERCION = {
  arrays: ['brand', 'skinType', 'shade'],
  numbers: ['minPrice', 'maxPrice', 'minRating'],
  booleans: ['onSale', 'isNew'],
};

const DeliveryQuery = z.object({ city: PkCity }).strict();

/** Public storefront reads (no account needed). */
@Public()
@Controller()
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  @Get('categories/:slug')
  category(@Param('slug') slug: string) {
    return this.catalog.category(parse(Slug, slug));
  }

  @Get('brands')
  brands() {
    return this.catalog.brands();
  }

  @Get('brands/:slug')
  brand(@Param('slug') slug: string) {
    return this.catalog.brand(parse(Slug, slug));
  }

  /** The listing engine for every listing page: filters, facets, sort and numbered pages. */
  @Get('search')
  @SearchLimit()
  search(@Query() raw: Record<string, unknown>) {
    const query = parse(
      SearchQuery.strict(),
      coerceQuery(raw, {
        ...LIST_COERCION,
        numbers: [...LIST_COERCION.numbers, 'page', 'pageSize'],
      }),
    );
    return this.catalog.search(query);
  }

  @Get('products')
  @SearchLimit(hasTextQuery)
  products(@Query() raw: Record<string, unknown>) {
    const query = parse(
      ProductQuery.strict(),
      coerceQuery(raw, {
        ...LIST_COERCION,
        arrays: [...LIST_COERCION.arrays, 'ids'],
        numbers: [...LIST_COERCION.numbers, 'limit'],
      }),
    );
    return this.catalog.products(query);
  }

  /** Declared before `products/:slug` so the delivery path is never read as a product slug. */
  @Get('products/:slug/delivery')
  delivery(@Param('slug') slug: string, @Query() raw: Record<string, unknown>) {
    const { city } = parse(DeliveryQuery, raw);
    return this.catalog.deliveryEstimate(parse(Slug, slug), city);
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string) {
    return this.catalog.product(parse(Slug, slug));
  }

  @Get('products/:slug/reviews')
  reviews(@Param('slug') slug: string) {
    return this.catalog.reviews(parse(Slug, slug));
  }

  /** GET /reviews?productId= — used by the SDK, which addresses reviews by product id. */
  @Get('reviews')
  reviewsById(@Query() raw: Record<string, unknown>) {
    const { productId } = parse(z.object({ productId: Id }).strict(), raw);
    return this.catalog.reviewsByProductId(productId);
  }

  @Get('stores')
  stores() {
    return this.catalog.stores();
  }

  @Get('stores/:slug')
  store(@Param('slug') slug: string) {
    return this.catalog.store(parse(Slug, slug));
  }
}
