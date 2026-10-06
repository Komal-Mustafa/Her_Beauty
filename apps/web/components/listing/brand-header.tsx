import type { Brand, Store } from '@hb/types';
import { Badge, cn } from '@hb/ui';
import Image from 'next/image';
import Link from 'next/link';
import { productCount } from '@/lib/listing-url';

type BrandHeaderProps = {
  brand: Brand;
  /** The store of the brand's owner, when it is a visible store here. */
  owner: Store | null;
  total: number;
  className?: string;
};

/**
 * Brand page header (docs/p5-catalog.md §1): the logo in a gold-ringed circle, the name as H1, the
 * Official Brand badge for a trademark-verified brand and "Sold by {store}" when its owner sells
 * here, then the result count.
 */
export function BrandHeader({ brand, owner, total, className }: BrandHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8', className)}>
      <span className="grid h-24 w-24 shrink-0 place-items-center rounded-pill border border-gold-500 bg-white shadow-soft md:h-32 md:w-32">
        <Image
          src={brand.logo.url}
          alt={brand.logo.alt}
          width={88}
          height={88}
          priority
          className="h-16 w-16 md:h-[88px] md:w-[88px]"
        />
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="eyebrow text-gold-800">Brand</p>
        <h1 className="font-display text-[34px] font-semibold leading-tight text-balance text-ink-900 [overflow-wrap:anywhere] md:text-[56px]">
          {brand.name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-500">
          {brand.isProtected ? <Badge kind="official" /> : null}
          {owner ? (
            <p>
              Sold by{' '}
              <Link
                href={`/store/${owner.slug}`}
                className="inline-flex min-h-11 items-center font-medium text-pink-600 underline-offset-4 hover:text-pink-700 hover:underline"
              >
                {owner.storeName}
              </Link>
            </p>
          ) : null}
          <p className="tabular-nums">{productCount(total)}</p>
        </div>
      </div>
    </header>
  );
}
