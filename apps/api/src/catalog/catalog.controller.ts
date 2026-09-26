import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { Id, ProductQuery, Slug } from '@hb/types';
import { z } from 'zod';
import { coerceQuery, parse } from '../common/validate';
import { CatalogService } from './catalog.service';

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

  @Get('products')
  products(@Query() raw: Record<string, unknown>) {
    const query = parse(
      ProductQuery.strict(),
      coerceQuery(raw, {
        arrays: ['brand', 'skinType'],
        numbers: ['minPrice', 'maxPrice', 'minRating', 'limit'],
      }),
    );
    return this.catalog.products(query);
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
