import type { Category } from '@hb/types';
import { Reveal } from '@hb/ui';
import Image from 'next/image';
import Link from 'next/link';

/**
 * Home §1 "Shop by category" (docs/p4-home.md §2): round images that echo the round logo. On hover
 * or keyboard focus a gold ring draws itself around the circle (stroke-dashoffset on a path of
 * length 1) and the image zooms slightly. Reduced motion: the ring appears at once.
 */
export function CategoryCircles({ categories }: { categories: readonly Category[] }) {
  return (
    <ul className="grid grid-cols-4 gap-x-3 gap-y-8 @2xl:grid-cols-8 @2xl:gap-x-4">
      {categories.map((c, i) => (
        <Reveal as="li" key={c.id} index={i}>
          <Link
            href={`/category/${c.slug}`}
            className="group flex flex-col items-center gap-3 rounded-card text-center"
          >
            <span className="relative block aspect-square w-full max-w-[112px]">
              <span className="absolute inset-[5%] overflow-hidden rounded-pill bg-blush-50 ring-1 ring-ink-200">
                <Image
                  src={c.image.url}
                  alt=""
                  fill
                  sizes="112px"
                  className="object-cover transition duration-slow ease-soft group-hover:scale-105 group-focus-visible:scale-105 motion-reduce:transition-none"
                />
              </span>
              <svg
                aria-hidden
                viewBox="0 0 100 100"
                className="absolute inset-0 h-full w-full -rotate-90 text-gold-500"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="48.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray="1"
                  strokeDashoffset="1"
                  className="transition-[stroke-dashoffset] duration-slow ease-soft group-hover:[stroke-dashoffset:0] group-focus-visible:[stroke-dashoffset:0] motion-reduce:transition-none"
                />
              </svg>
            </span>
            <span className="text-sm font-medium text-ink-900 transition-colors duration-base group-hover:text-pink-600">
              {c.name}
            </span>
          </Link>
        </Reveal>
      ))}
    </ul>
  );
}
