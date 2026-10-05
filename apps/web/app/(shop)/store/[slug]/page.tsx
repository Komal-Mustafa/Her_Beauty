import { Container } from '@hb/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ListingLayout } from '@/components/listing/listing-layout';
import { listingMetadata } from '@/components/listing/listing-metadata';
import { listingSearch } from '@/components/listing/load-listing';
import { StoreHeader } from '@/components/listing/store-header';
import { hasFilters, parseListingParams } from '@/lib/listing-params';
import { breadcrumbJsonLd, type Crumb } from '@/lib/seo/json-ld';
import { JsonLd } from '@/lib/seo/json-ld-script';
import { loadStore } from './load-store';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const store = await loadStore(slug);
  if (!store) return { title: 'Store not found' };
  const listing = parseListingParams('store', query);
  // The same search as the page (cached per request): its page count settles whether this URL is
  // a page of results at all (§2.3).
  const { pageCount } = await listingSearch('store', listing, { seller: store.slug });
  return listingMetadata({
    kind: 'store',
    path: `/store/${store.slug}`,
    title: store.storeName,
    description:
      store.about ||
      `${store.storeName}, a ${store.badge === 'official_brand' ? 'brand store' : 'verified seller'} from ${store.city} on Her Beauty.`,
    params: listing,
    raw: query,
    pageCount,
  });
}

/**
 * Store listing (docs/p5-catalog.md §1): the seller is the fixed filter, under the store header
 * (banner, logo, badge, type, city, rating, joined, product count, about). Unknown slug → 404.
 */
export default async function StorePage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const store = await loadStore(slug);
  if (!store) notFound();

  const path = `/store/${store.slug}`;
  const listing = parseListingParams('store', query);
  const result = await listingSearch('store', listing, { seller: store.slug });
  const crumbs: Crumb[] = [
    { label: 'Home', href: '/' },
    { label: store.storeName, href: path },
  ];

  return (
    <Container className="pb-16 pt-2 md:pb-24">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} className="mb-4" />
      <ListingLayout
        kind="store"
        path={path}
        params={listing}
        result={result}
        header={<StoreHeader store={store} total={result.total} filtered={hasFilters(listing)} />}
      />
    </Container>
  );
}
