import type { Brand, FeaturedBrand } from '@hb/types';
import { Badge, SectionHeading } from '@hb/ui';
import { ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { BrandLogo } from '@/components/home/brand-logo';
import { productCount } from '@/lib/listing-url';

/** The index letter of a brand: A–Z after removing accents (Élan → E), anything else is "#". */
export function brandLetter(name: string): string {
  const first = name
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .trim()
    .charAt(0)
    .toUpperCase();
  return /^[A-Z]$/.test(first) ? first : '#';
}

/** Brands grouped by letter, A–Z by name inside each, "#" last. */
export function brandsByLetter(brands: readonly Brand[]): [string, Brand[]][] {
  const groups = new Map<string, Brand[]>();
  const sorted = [...brands].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
  );
  for (const brand of sorted) {
    const letter = brandLetter(brand.name);
    groups.set(letter, [...(groups.get(letter) ?? []), brand]);
  }
  return [...groups].sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)));
}

const letterId = (letter: string) => `brands-${letter === '#' ? 'other' : letter.toLowerCase()}`;

type BrandDirectoryProps = {
  brands: readonly Brand[];
  /** Paid placements (Icon first, then Luxe): shown first, always with Sponsored. */
  featured: readonly FeaturedBrand[];
  /** Live products per brand slug; null when they could not be counted (then not shown). */
  counts: ReadonlyMap<string, number> | null;
};

/**
 * /brands (docs/p5-catalog.md §1): featured brands first, labelled Sponsored (P4 rule), then every
 * brand A–Z under a letter index that lists only letters with brands. Each brand shows its logo,
 * the Official badge when it is trademark-verified and how many products it has here.
 */
export function BrandDirectory({ brands, featured, counts }: BrandDirectoryProps) {
  const groups = brandsByLetter(brands);
  return (
    <div className="flex flex-col gap-12 md:gap-16">
      {featured.length > 0 ? (
        <section aria-labelledby="featured-brands-title">
          <SectionHeading
            eyebrow="Featured"
            title={<span id="featured-brands-title">Featured brands</span>}
            className="mb-6"
          />
          <ul className="flex flex-wrap gap-4">
            {featured.map((b) => (
              <li key={b.id}>
                <BrandLogo brand={b} sponsored />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="all-brands-title">
        <SectionHeading
          eyebrow="A–Z"
          title={<span id="all-brands-title">Every brand</span>}
          className="mb-6"
        />
        <nav aria-label="Brands by letter" className="mb-8">
          <ul className="flex flex-wrap gap-1">
            {groups.map(([letter]) => (
              <li key={letter}>
                <a
                  href={`#${letterId(letter)}`}
                  className="inline-flex h-11 min-w-11 items-center justify-center rounded-pill border border-ink-200 px-3 font-display text-lg text-ink-900 transition-colors duration-fast hover:border-pink-600 hover:text-pink-700"
                >
                  {letter === '#' ? (
                    <>
                      <span aria-hidden>#</span>
                      <span className="sr-only">Other</span>
                    </>
                  ) : (
                    letter
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-10">
          {groups.map(([letter, list]) => (
            <section key={letter} aria-labelledby={letterId(letter)}>
              <h3
                id={letterId(letter)}
                className="mb-4 border-b border-gold-500/60 pb-2 font-display text-[28px] text-ink-900"
              >
                {letter === '#' ? 'Other' : letter}
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {list.map((brand) => (
                  <li key={brand.id}>
                    <BrandRow brand={brand} count={counts ? (counts.get(brand.slug) ?? 0) : null} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function BrandRow({ brand, count }: { brand: Brand; count: number | null }) {
  return (
    <Link
      href={`/brand/${brand.slug}`}
      className="group flex min-h-20 items-center gap-4 rounded-card border border-ink-200 bg-white p-3 pr-4 transition duration-base ease-soft hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-soft motion-reduce:hover:translate-y-0"
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-pill border border-gold-500 bg-white">
        <Image src={brand.logo.url} alt="" width={40} height={40} className="h-10 w-10" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="font-medium text-ink-900 group-hover:text-pink-700">{brand.name}</span>
        <span className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
          {brand.isProtected ? <Badge kind="official">Official</Badge> : null}
          {count === null ? null : <span className="tabular-nums">{productCount(count)}</span>}
        </span>
      </span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-gold-600" />
    </Link>
  );
}
