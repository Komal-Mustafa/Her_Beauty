import { getApi } from '@hb/sdk';
import { Container } from '@hb/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { CategoryBannerAd } from '@/components/listing/category-banner-ad';
import { ListingHeader } from '@/components/listing/listing-header';
import { ListingLayout } from '@/components/listing/listing-layout';
import { listingMetadata } from '@/components/listing/listing-metadata';
import { parseListingParams, toSearchQuery } from '@/lib/listing-params';
import { optional } from '@/lib/optional';
import { breadcrumbJsonLd, type Crumb } from '@/lib/seo/json-ld';
import { JsonLd } from '@/lib/seo/json-ld-script';
import { loadCategory } from './load-category';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const category = await loadCategory(slug);
  if (!category) return { title: 'Category not found' };
  return listingMetadata({
    kind: 'category',
    path: `/category/${category.slug}`,
    title: category.name,
    description: `Shop ${category.name.toLowerCase()} from verified sellers and official brands in Pakistan, with payment protected until delivery.`,
    params: parseListingParams('category', query),
  });
}

/**
 * Category listing (docs/p5-catalog.md §1, §2): the category is the fixed filter, best sellers
 * first by default, and a booked category banner ad above the grid. Unknown slug → 404 (layout).
 */
export default async function CategoryPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const category = await loadCategory(slug);
  if (!category) notFound();

  const api = getApi();
  const path = `/category/${category.slug}`;
  const listing = parseListingParams('category', query);
  const [result, [ad]] = await Promise.all([
    api.search(toSearchQuery('category', listing, { category: category.slug })),
    optional('category banner', api.getAdSlots('category_banner', { category: category.slug }), []),
  ]);
  const crumbs: Crumb[] = [
    { label: 'Home', href: '/' },
    { label: category.name, href: path },
  ];

  return (
    <Container className="pb-16 pt-2 md:pb-24">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} className="mb-2" />
      <ListingLayout
        kind="category"
        path={path}
        params={listing}
        result={result}
        header={
          <>
            <ListingHeader eyebrow="Category" title={category.name} total={result.total} />
            {ad ? <CategoryBannerAd ad={ad} className="mt-8" /> : null}
          </>
        }
      />
    </Container>
  );
}
