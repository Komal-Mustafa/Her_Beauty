import { Container } from '@hb/ui';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ListingHeader } from '@/components/listing/listing-header';
import { ListingLayout } from '@/components/listing/listing-layout';
import { listingMetadata } from '@/components/listing/listing-metadata';
import { listingSearch } from '@/components/listing/load-listing';
import { parseListingParams } from '@/lib/listing-params';
import { breadcrumbJsonLd, type Crumb } from '@/lib/seo/json-ld';
import { JsonLd } from '@/lib/seo/json-ld-script';

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PATH = '/new';
const TITLE = 'New in';
const CRUMBS: Crumb[] = [
  { label: 'Home', href: '/' },
  { label: TITLE, href: PATH },
];

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const query = await searchParams;
  const listing = parseListingParams('new', query);
  // The same search as the page (cached per request): its page count settles whether this URL is
  // a page of results at all (§2.3).
  const { pageCount } = await listingSearch('new', listing, { isNew: true });
  return listingMetadata({
    kind: 'new',
    path: PATH,
    title: TITLE,
    description:
      'The newest lipsticks, skincare, fragrance and more from verified sellers and official brands on Her Beauty.',
    params: listing,
    raw: query,
    pageCount,
  });
}

/** New in (docs/p5-catalog.md §1): only new products, newest first by default. */
export default async function NewPage({ searchParams }: PageProps) {
  const listing = parseListingParams('new', await searchParams);
  const result = await listingSearch('new', listing, { isNew: true });

  return (
    <Container className="pb-16 pt-2 md:pb-24">
      <JsonLd data={breadcrumbJsonLd(CRUMBS)} />
      <Breadcrumbs items={CRUMBS} className="mb-2" />
      <ListingLayout
        kind="new"
        path={PATH}
        params={listing}
        result={result}
        header={<ListingHeader eyebrow="Just landed" title={TITLE} total={result.total} />}
      />
    </Container>
  );
}
