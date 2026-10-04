import type { Currency, Money, Product, Review } from '@hb/types';
import { SITE } from '../site';

/*
 * schema.org structured data (docs/p5-catalog.md §5 SEO, §10). Builders return plain objects; the
 * `JsonLd` component (json-ld-script.tsx) serialises them with `serializeJsonLd`.
 */

export type JsonLdObject = { [key: string]: unknown };

const CONTEXT = 'https://schema.org';
/** Reviews quoted in a product's structured data. */
export const JSON_LD_MAX_REVIEWS = 5;

/**
 * JSON for a `<script type="application/ld+json">`. Every `<` becomes `<` (same string once
 * parsed), so product text such as `</script><script>…` can never close the tag.
 */
export function serializeJsonLd(data: JsonLdObject | readonly JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

const MINOR_UNITS: Record<Currency, number> = { PKR: 100, USD: 100 };

/** Integer paisa → "1850.00", with integer maths only (rules.md §1.2: no floats for money). */
export function moneyToDecimal(amount: Money, currency: Currency = 'PKR'): string {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError(`Money must be a non-negative integer, got ${amount}`);
  }
  const unit = MINOR_UNITS[currency];
  const major = Math.trunc(amount / unit);
  const minor = amount % unit;
  return `${major}.${String(minor).padStart(2, '0')}`;
}

/** An absolute URL on this site (JSON-LD and Open Graph need absolute URLs). */
export function absoluteUrl(path: string, base: string = SITE.url): string {
  return new URL(path, base).toString();
}

export type Crumb = { label: string; href: string };

export function breadcrumbJsonLd(crumbs: readonly Crumb[]): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: absoluteUrl(c.href),
    })),
  };
}

type ProductJsonLdInput = {
  product: Product;
  /** Plain-text description (the sanitizer's `descriptionText`). */
  description: string;
  /** Newest first; the first five are quoted. */
  reviews: readonly Review[];
};

export function productJsonLd({ product, description, reviews }: ProductJsonLdInput): JsonLdObject {
  const url = absoluteUrl(`/product/${product.slug}`);
  const prices = product.variants.map((v) => v.price);
  const inStock = product.variants.some((v) => v.stock > 0);
  const currency = product.variants[0]?.currency ?? product.currency;
  return {
    '@context': CONTEXT,
    '@type': 'Product',
    name: product.title,
    url,
    image: product.images.map((i) => absoluteUrl(i.url)),
    ...(description ? { description } : {}),
    sku: product.variants[0]?.sku,
    brand: { '@type': 'Brand', name: product.brand.name },
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            ratingCount: product.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(reviews.length ? { review: reviews.slice(0, JSON_LD_MAX_REVIEWS).map(reviewJsonLd) } : {}),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: currency,
      lowPrice: moneyToDecimal(Math.min(...prices), currency),
      highPrice: moneyToDecimal(Math.max(...prices), currency),
      offerCount: product.variants.length,
      availability: `${CONTEXT}/${inStock ? 'InStock' : 'OutOfStock'}`,
      url,
      seller: { '@type': 'Organization', name: product.seller.storeName },
    },
  };
}

function reviewJsonLd(r: Review): JsonLdObject {
  return {
    '@type': 'Review',
    name: r.title,
    reviewBody: r.body,
    datePublished: r.createdAt.slice(0, 10),
    author: { '@type': 'Person', name: r.authorName },
    reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
  };
}

/** Root layout: the site and its search, so search engines can offer a site search box. */
export function websiteJsonLd(): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    name: SITE.name,
    url: absoluteUrl('/'),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        // Built by hand: URL encoding would turn the braces of the placeholder into %7B…%7D.
        urlTemplate: `${absoluteUrl('/search')}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
