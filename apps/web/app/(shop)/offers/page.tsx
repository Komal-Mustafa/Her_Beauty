import { Container } from '@hb/ui';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ListingLayout } from '@/components/listing/listing-layout';
import { listingMetadata } from '@/components/listing/listing-metadata';
import { listingSearch } from '@/components/listing/load-listing';
import { OffersBand } from '@/components/listing/offers-band';
import { parseListingParams } from '@/lib/listing-params';
import { breadcrumbJsonLd, type Crumb } from '@/lib/seo/json-ld';
import { JsonLd } from '@/lib/seo/json-ld-script';

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PATH = '/offers';
const CRUMBS: Crumb[] = [
  { label: 'Home', href: '/' },
  { label: 'Offers', href: PATH },
];

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const query = await searchParams;
  const listing = parseListingParams('offers', query);
  // The same search as the page (cached per request): its page count settles whether this URL is
  // a page of results at all (§2.3).
  const { pageCount } = await listingSearch('offers', listing, { onSale: true });
  return listingMetadata({
    kind: 'offers',
    path: PATH,
    title: 'Offers',
    description:
      'Beauty on sale from verified sellers and official brands, biggest discounts first, with payment protected until delivery.',
    params: listing,
    raw: query,
    pageCount,
  });
}

/** Offers (docs/p5-catalog.md §1): only products on sale, biggest discount first by default. */
export default async function OffersPage({ searchParams }: PageProps) {
  const listing = parseListingParams('offers', await searchParams);
  const result = await listingSearch('offers', listing, { onSale: true });

  return (
    <Container className="pb-16 pt-2 md:pb-24">
      <JsonLd data={breadcrumbJsonLd(CRUMBS)} />
      <Breadcrumbs items={CRUMBS} className="mb-2" />
      <ListingLayout
        kind="offers"
        path={PATH}
        params={listing}
        result={result}
        header={<OffersBand total={result.total} />}
      />
    </Container>
  );
}
