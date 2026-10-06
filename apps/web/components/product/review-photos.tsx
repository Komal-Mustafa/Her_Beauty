'use client';

import type { Asset } from '@hb/types';
import { Modal } from '@hb/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

const navButton =
  'grid h-11 w-11 place-items-center rounded-pill border border-ink-200 bg-white text-ink-900 transition duration-fast ease-soft hover:border-pink-600 hover:text-pink-600';

/**
 * A review's photos as thumbnail buttons; each opens a lightbox (`Modal`: focus trap, Escape
 * closes, focus returns to the thumbnail) with previous / next when there are several.
 */
export function ReviewPhotos({ photos, author }: { photos: readonly Asset[]; author: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const photo = open === null ? undefined : photos[open];
  const count = photos.length;
  if (count === 0) return null;

  const step = (by: number) => setOpen((i) => (i === null ? i : (i + by + count) % count));

  return (
    <>
      <ul className="mt-4 flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <li key={`${p.url}-${i}`}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Open photo ${i + 1} of ${count} from ${author}`}
              className="relative block h-16 w-16 overflow-hidden rounded-btn border border-ink-200 bg-blush-50 transition-colors duration-fast hover:border-pink-600"
            >
              <Image src={p.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <Modal
        open={photo !== undefined}
        onOpenChange={(o) => {
          if (!o) setOpen(null);
        }}
        title={count > 1 ? `Photo ${(open ?? 0) + 1} of ${count}` : 'Review photo'}
        description={`From ${author}’s review`}
      >
        {photo ? (
          <div
            onKeyDown={(e) => {
              if (count < 2) return;
              if (e.key === 'ArrowRight') step(1);
              if (e.key === 'ArrowLeft') step(-1);
            }}
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-btn bg-blush-50">
              <Image
                src={photo.url}
                alt={photo.alt || `Photo from ${author}’s review`}
                fill
                sizes="(min-width: 640px) 512px, 92vw"
                className="object-contain"
              />
            </div>
            {count > 1 ? (
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={() => step(-1)}
                  className={navButton}
                >
                  <ChevronLeft aria-hidden className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() => step(1)}
                  className={navButton}
                >
                  <ChevronRight aria-hidden className="h-5 w-5" />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
