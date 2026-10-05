import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { Id, PkCity, ProductQuery, SearchQuery, Slug } from '@hb/types';
import { z } from 'zod';
import { PerMinute, Public } from '../auth/decorators';
import { coerceQuery, parse } from '../common/validate';
import { CatalogService } from './catalog.service';

/** security.md §11: search is limited per IP. */
const SEARCH_PER_MINUTE = 60;

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
  @PerMinute(SEARCH_PER_MINUTE)
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
