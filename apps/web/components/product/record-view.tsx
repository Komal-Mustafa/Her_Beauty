'use client';

import { useEffect } from 'react';
import { recordProductView } from '@/lib/recent-store';

/** Adds the product to "Recently viewed" (`hb_recent_v1`) once the page is on screen. */
export function RecordProductView({
  productId,
  productSlug,
}: {
  productId: string;
  productSlug: string;
}) {
  useEffect(() => {
    recordProductView({ productId, productSlug });
  }, [productId, productSlug]);
  return null;
}
