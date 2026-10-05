'use client';

import { Button, cn, Modal } from '@hb/ui';
import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { activeChips, productCount } from '@/lib/listing-url';
import styles from './filter-drawer.module.css';
import { FilterPanel } from './filter-panel';
import { useListing } from './listing-context';

/**
 * Below 1024 px (docs/p5-catalog.md §2.1 "Mobile drawer"): a "Filters (n)" button opens the same
 * filter groups in a Radix dialog that slides in from the left. Filters still apply at once; the
 * footer button "Show {total} products" closes it. Radix traps focus and closes on Escape; focus
 * then goes back to the Filters button (the shared Modal has no trigger to return it to).
 */
export function FilterDrawer({ className }: { className?: string }) {
  const { params, facets, total, pending } = useListing();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const applied = activeChips(params, facets).length;

  useEffect(() => {
    if (wasOpen.current && !open) buttonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="secondary"
        size="sm"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn('h-11', className)}
      >
        <SlidersHorizontal aria-hidden className="h-4 w-4" />
        Filters
        {applied > 0 ? (
          <span className="tabular-nums">
            <span aria-hidden>({applied})</span>
            <span className="sr-only">, {applied} applied</span>
          </span>
        ) : null}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Filters"
        placement="right"
        className={cn('left-0 right-auto w-[min(88vw,380px)] pb-0', styles.drawer)}
      >
        {/* Wheel scrolling here belongs to the drawer, not to the page's smooth scroll. */}
        <div data-lenis-prevent>
          <FilterPanel idPrefix="drawer" />
          <div className="sticky bottom-0 -mx-1 mt-2 border-t border-ink-200 bg-white px-1 py-4">
            <Button
              type="button"
              block
              aria-busy={pending || undefined}
              onClick={() => setOpen(false)}
            >
              Show {productCount(total)}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
