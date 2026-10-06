import { getApi } from '@hb/sdk';
import { Container } from '@hb/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { BrandHeader } from '@/components/listing/brand-header';
import { ListingLayout } from '@/components/listing/listing-layout';
import { listingMetadata } from '@/components/listing/listing-metadata';
import { listingSearch } from '@/components/listing/load-listing';
import { parseListingParams } from '@/lib/listing-params';
import { optional } from '@/lib/optional';
import { breadcrumbJsonLd, type Crumb } from '@/lib/seo/json-ld';
import { JsonLd } from '@/lib/seo/json-ld-script';
import { loadBrand } from './load-brand';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const brand = await loadBrand(slug);
  if (!brand) return { title: 'Brand not found' };
  const listing = parseListingParams('brand', query);
  // The same search as the page (cached per request): its page count settles whether this URL is
  // a page of results at all (§2.3).
  const { pageCount } = await listingSearch('brand', listing, { brand: [brand.slug] });
  return listingMetadata({
    kind: 'brand',
    path: `/brand/${brand.slug}`,
    title: brand.name,
    description: `Shop ${brand.name}${brand.isProtected ? ', an official brand,' : ''} on Her Beauty: genuine products from verified sellers, with payment protected until delivery.`,
    params: listing,
    raw: query,
    pageCount,
  });
}

/**
 * Brand listing (docs/p5-catalog.md §1): the brand is the fixed filter; the header shows its logo,
 * the Official Brand badge when trademark-verified and "Sold by {store}" when the owner is a
 * visible store here. Unknown slug → 404 (layout).
 */
export default async function BrandPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const brand = await loadBrand(slug);
  if (!brand) notFound();

  const api = getApi();
  const path = `/brand/${brand.slug}`;
  const listing = parseListingParams('brand', query);
  const [result, stores] = await Promise.all([
    listingSearch('brand', listing, { brand: [brand.slug] }),
    // Only visible stores are listed, so a hidden or suspended owner gets no link.
    brand.ownerSellerId ? optional('stores', api.getStores(), []) : [],
  ]);
  const owner = stores.find((s) => s.id === brand.ownerSellerId) ?? null;
  const crumbs: Crumb[] = [
    { label: 'Home', href: '/' },
    { label: 'Brands', href: '/brands' },
    { label: brand.name, href: path },
  ];

  return (
    <Container className="pb-16 pt-2 md:pb-24">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} className="mb-4" />
      <ListingLayout
        kind="brand"
        path={path}
        params={listing}
        result={result}
        header={<BrandHeader brand={brand} owner={owner} total={result.total} />}
      />
    </Container>
  );
}
