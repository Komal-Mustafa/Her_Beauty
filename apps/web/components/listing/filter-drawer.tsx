'use client';

import { Button, cn, Modal } from '@hb/ui';
import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { activeChips, productCount } from '@/lib/listing-url';
import styles from './filter-drawer.module.css';
import { FilterPanel } from './filter-panel';
import { FILTERS_HEADING_ID } from './ids';
import { ListingStatus, useListing } from './listing-context';

/**
 * Below 1024 px (docs/p5-catalog.md §2.1 "Mobile drawer"): a "Filters (n)" button opens the same
 * filter groups in a Radix dialog that slides in from the left. Filters still apply at once; the
 * footer button "Show {total} products" closes it. Radix traps focus and closes on Escape; focus
 * then goes back to the Filters button (the shared Modal has no trigger to return it to). The
 * dialog hides the page from assistive tech, so it reads out the result count itself.
 */
export function FilterDrawer({ className }: { className?: string }) {
  const { params, facets, total, pending } = useListing();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const widened = useRef(false);
  const applied = activeChips(params, facets).length;

  useEffect(() => {
    if (wasOpen.current && !open) {
      // Closed by widening the window: the Filters button is hidden now, the sidebar is not.
      const target = widened.current
        ? document.getElementById(FILTERS_HEADING_ID)
        : buttonRef.current;
      target?.focus();
      widened.current = false;
    }
    wasOpen.current = open;
  }, [open]);

  // From 1024 px the filters are in the sidebar: a drawer left open by resizing closes itself.
  useEffect(() => {
    if (!open) return;
    const wide = window.matchMedia('(min-width: 64rem)');
    const close = () => {
      if (!wide.matches) return;
      widened.current = true;
      setOpen(false);
    };
    close();
    wide.addEventListener('change', close);
    return () => wide.removeEventListener('change', close);
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
        {/* One spoken name ("Filters, 2 applied"): split text would be read with odd spaces. */}
        <span aria-hidden className="tabular-nums">
          Filters{applied > 0 ? ` (${applied})` : ''}
        </span>
        <span className="sr-only">{applied > 0 ? `Filters, ${applied} applied` : 'Filters'}</span>
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Filters"
        placement="right"
        className={cn('left-0 right-auto w-[min(88vw,380px)] pb-0', styles.drawer)}
      >
        {/* Wheel scrolling here belongs to the drawer, not to the page's smooth scroll. The inline
            padding keeps focus rings inside the dialog's scroll box, which clips them. */}
        <div data-lenis-prevent className="px-1.5">
          <ListingStatus fresh />
          <FilterPanel idPrefix="drawer" />
          <div className="sticky bottom-0 -mx-1.5 mt-2 border-t border-ink-200 bg-white px-1.5 py-4">
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
