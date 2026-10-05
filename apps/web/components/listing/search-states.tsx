import type { Category, ProductCard } from '@hb/types';
import { Button, EmptyState, SectionHeading } from '@hb/ui';
import Link from 'next/link';
import { CategoryCircles } from '@/components/home/category-circles';
import { SearchForm } from '@/components/layout/search-form';
import { ProductCarousel } from '@/components/product/product-carousel';

type SuggestionsProps = { categories: readonly Category[]; trending: readonly ProductCard[] };

/** Where to go next: category circles and the trending carousel (docs/p5-catalog.md §1). */
export function SearchSuggestions({ categories, trending }: SuggestionsProps) {
  return (
    <div className="@container flex flex-col gap-16 md:gap-20">
      {categories.length > 0 ? (
        <section aria-labelledby="search-categories-title">
          <SectionHeading
            eyebrow="Explore"
            title={<span id="search-categories-title">Shop by category</span>}
          />
          <CategoryCircles categories={categories} />
        </section>
      ) : null}
      <ProductCarousel
        id="search-trending"
        eyebrow="Best sellers"
        title="Trending now"
        products={trending}
      />
    </div>
  );
}

/** /search without text or filters: a big search box, then suggestions. */
export function SearchStart(props: SuggestionsProps) {
  return (
    <div className="flex flex-col gap-12 md:gap-16">
      <header className="flex max-w-2xl flex-col gap-4">
        <p className="eyebrow text-gold-800">Search</p>
        <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900 md:text-[56px]">
          What are you looking for?
        </h1>
        <p className="text-ink-500">
          Search products, brands and stores. Spelling slips are fine: “lipstik” finds lipsticks.
        </p>
        <SearchForm id="search-page-q" className="mt-2" />
      </header>
      <SearchSuggestions {...props} />
    </div>
  );
}

/** A search with no results at all (no filters applied): say so, then suggest. */
export function SearchNoResults({ q, ...props }: SuggestionsProps & { q: string }) {
  return (
    <div className="flex flex-col gap-12 md:gap-16">
      <div className="flex flex-col items-center">
        <h2 className="sr-only">Products</h2>
        <EmptyState
          title={`We couldn’t find “${q}”`}
          body="Check the spelling or try a shorter word. Or browse a category below."
          action={
            <Button asChild>
              <Link href="/new">See new arrivals</Link>
            </Button>
          }
          className="pb-6"
        />
        <SearchForm id="search-again-q" className="w-full max-w-md" />
      </div>
      <SearchSuggestions {...props} />
    </div>
  );
}
