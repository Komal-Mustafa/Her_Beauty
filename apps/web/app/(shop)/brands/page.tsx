import { getApi } from '@hb/sdk';
import { Container } from '@hb/ui';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { BrandDirectory } from '@/components/listing/brand-directory';
import { listingMetadata } from '@/components/listing/listing-metadata';
import { optional } from '@/lib/optional';
import { breadcrumbJsonLd, type Crumb } from '@/lib/seo/json-ld';
import { JsonLd } from '@/lib/seo/json-ld-script';

const PATH = '/brands';
const CRUMBS: Crumb[] = [
  { label: 'Home', href: '/' },
  { label: 'Brands', href: PATH },
];

export const metadata: Metadata = listingMetadata({
  kind: 'brands',
  path: PATH,
  title: 'All brands',
  description:
    'Every beauty brand on Her Beauty from A to Z, with official brands verified by trademark.',
});

/**
 * All brands (docs/p5-catalog.md §1): featured brands first (Sponsored), then A–Z with a letter
 * index. Product counts come from the search facets; featured brands and counts are optional.
 */
export default async function BrandsPage() {
  const api = getApi();
  const [brands, featured, facets] = await Promise.all([
    api.getBrands(),
    optional('featured brands', api.getFeaturedBrands(), []),
    optional(
      'brand counts',
      api.search({}).then((r) => r.facets.brands),
      null,
    ),
  ]);
  const counts = facets ? new Map(facets.map((f) => [f.value, f.count])) : null;

  return (
    <Container className="pb-16 pt-2 md:pb-24">
      <JsonLd data={breadcrumbJsonLd(CRUMBS)} />
      <Breadcrumbs items={CRUMBS} className="mb-2" />
      <header className="mb-12 flex flex-col gap-2 md:mb-16">
        <p className="eyebrow text-gold-800">Brands</p>
        <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900 md:text-[56px]">
          All brands
        </h1>
        <p className="text-sm tabular-nums text-ink-500">
          {brands.length.toLocaleString('en-PK')} {brands.length === 1 ? 'brand' : 'brands'}
        </p>
      </header>
      <BrandDirectory brands={brands} featured={featured} counts={counts} />
    </Container>
  );
}
