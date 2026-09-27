import type { Brand } from '@hb/types';
import { Badge } from '@hb/ui';
import Image from 'next/image';
import Link from 'next/link';

/** Gold-bordered round brand logo (04 §6.1 "Official brands"); paid placements say Sponsored. */
export function BrandLogo({ brand, sponsored = false }: { brand: Brand; sponsored?: boolean }) {
  return (
    <Link
      href={`/brand/${brand.slug}`}
      className="group flex w-28 flex-col items-center gap-2 rounded-card p-1 text-center"
    >
      <span className="grid h-20 w-20 place-items-center rounded-pill border border-gold-500 bg-white shadow-soft transition duration-base ease-soft group-hover:-translate-y-0.5 motion-reduce:group-hover:translate-y-0">
        <Image src={brand.logo.url} alt="" width={56} height={56} className="h-14 w-14" />
      </span>
      <span className="text-sm font-medium text-ink-900 group-hover:text-pink-700">
        {brand.name}
      </span>
      {sponsored ? <Badge kind="sponsored" /> : null}
    </Link>
  );
}
