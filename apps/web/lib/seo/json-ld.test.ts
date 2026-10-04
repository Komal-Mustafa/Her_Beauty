import { describe, expect, it } from 'vitest';
import { lipstick, review } from '@/components/product/test-product';
import { SITE } from '../site';
import {
  absoluteUrl,
  breadcrumbJsonLd,
  JSON_LD_MAX_REVIEWS,
  moneyToDecimal,
  productJsonLd,
  serializeJsonLd,
  websiteJsonLd,
} from './json-ld';

describe('moneyToDecimal', () => {
  it.each([
    [185000, '1850.00'],
    [123456, '1234.56'],
    [5, '0.05'],
    [0, '0.00'],
    [100, '1.00'],
    [Number.MAX_SAFE_INTEGER, '90071992547409.91'],
  ])('%i paisa → %s', (paisa, decimal) => {
    expect(moneyToDecimal(paisa)).toBe(decimal);
  });

  it.each([1.5, -1, Number.NaN, Number.POSITIVE_INFINITY])('refuses %s', (bad) => {
    expect(() => moneyToDecimal(bad)).toThrow(RangeError);
  });
});

describe('serializeJsonLd', () => {
  it('escapes every < so text cannot close the script tag', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script><!--' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script><!--' });
  });
});

describe('productJsonLd', () => {
  const product = lipstick();
  const data = productJsonLd({
    product,
    description: 'Soft matte colour.',
    reviews: Array.from({ length: 7 }, (_, i) => review(i + 1)),
  });

  it('describes the product with absolute URLs', () => {
    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Velvet Matte Lipstick',
      url: absoluteUrl('/product/velvet-matte-lipstick'),
      description: 'Soft matte colour.',
      sku: 'VELVET-1',
      brand: { '@type': 'Brand', name: 'Glow' },
      aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.8, ratingCount: 214 },
    });
    expect(data.image).toEqual([
      absoluteUrl('/placeholders/lipstick-1.svg'),
      absoluteUrl('/placeholders/lipstick-2.svg'),
    ]);
    expect(String((data.image as string[])[0])).toMatch(/^https?:\/\//);
  });

  it('offers every variant as one AggregateOffer with decimal prices from paisa', () => {
    const variants = product.variants.map((v, i) => ({ ...v, price: 150000 + i * 12345 }));
    const offers = productJsonLd({
      product: { ...product, variants },
      description: '',
      reviews: [],
    }).offers;
    expect(offers).toEqual({
      '@type': 'AggregateOffer',
      priceCurrency: 'PKR',
      lowPrice: '1500.00',
      highPrice: '1746.90',
      offerCount: 3,
      availability: 'https://schema.org/InStock',
      url: absoluteUrl('/product/velvet-matte-lipstick'),
      seller: { '@type': 'Organization', name: 'Glow Cosmetics' },
    });
  });

  it('is out of stock when no variant is', () => {
    const variants = product.variants.map((v) => ({ ...v, stock: 0 }));
    const out = productJsonLd({ product: { ...product, variants }, description: '', reviews: [] });
    expect(out.offers).toMatchObject({ availability: 'https://schema.org/OutOfStock' });
  });

  it('quotes at most five reviews and leaves out empty parts', () => {
    expect(data.review).toHaveLength(JSON_LD_MAX_REVIEWS);
    expect((data.review as object[])[0]).toEqual({
      '@type': 'Review',
      name: 'Review 1',
      reviewBody: 'Lovely colour.',
      datePublished: '2026-09-11',
      author: { '@type': 'Person', name: 'Shopper 1' },
      reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5, worstRating: 1 },
    });
    const bare = productJsonLd({
      product: { ...product, ratingCount: 0, rating: 0 },
      description: '',
      reviews: [],
    });
    expect(bare).not.toHaveProperty('aggregateRating');
    expect(bare).not.toHaveProperty('review');
    expect(bare).not.toHaveProperty('description');
  });
});

describe('breadcrumbJsonLd', () => {
  it('lists the trail in order with absolute links', () => {
    expect(
      breadcrumbJsonLd([
        { label: 'Home', href: '/' },
        { label: 'Lips', href: '/category/lips' },
        { label: 'Velvet Matte Lipstick', href: '/product/velvet-matte-lipstick' },
      ]),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: 'Lips', item: absoluteUrl('/category/lips') },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Velvet Matte Lipstick',
          item: absoluteUrl('/product/velvet-matte-lipstick'),
        },
      ],
    });
  });
});

describe('websiteJsonLd', () => {
  it('points the search action at /search with the placeholder intact', () => {
    const data = websiteJsonLd();
    expect(data).toMatchObject({ '@type': 'WebSite', name: SITE.name });
    expect(data.potentialAction).toEqual({
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${absoluteUrl('/search')}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    });
  });
});
