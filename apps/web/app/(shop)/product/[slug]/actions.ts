'use server';

import { getApi } from '@hb/sdk';
import { Id, PkCity, Slug, type ProductCard } from '@hb/types';
import { z } from 'zod';
import type { DeliveryEstimateResult } from '@/components/product/delivery-text';
import { optional } from '@/lib/optional';

/*
 * Server actions of the product page (docs/p5-catalog.md §5). Anyone can call them with any
 * arguments, so every input is validated here (§7) before it reaches the API, and a failure is an
 * answer the page can show, never a thrown error.
 */

const EstimateInput = z.object({ productSlug: Slug.max(200), city: PkCity });

/** Delivery time and cost of one item of the product to the city (GET /products/:slug/delivery). */
export async function deliveryEstimate(
  productSlug: string,
  city: string,
): Promise<DeliveryEstimateResult> {
  const input = EstimateInput.safeParse({ productSlug, city });
  if (!input.success) return { ok: false };
  const estimate = await optional(
    'delivery estimate',
    getApi().getDeliveryEstimate(input.data.productSlug, input.data.city),
    null,
  );
  // null also when the product went off sale since the page was rendered.
  return estimate ? { ok: true, estimate } : { ok: false };
}

/** The "Recently viewed" carousel shows at most this many (`MAX_RECENT` in lib/recent-store). */
const RecentIds = z.array(Id.max(100)).min(1).max(12);

/**
 * Cards for "Recently viewed": the ids come from the shopper's localStorage, so they are checked
 * again here. Same order as asked; hidden and unknown products are skipped (getProducts `ids`).
 */
export async function recentlyViewedCards(ids: readonly string[]): Promise<ProductCard[]> {
  const input = RecentIds.safeParse(ids);
  if (!input.success) return [];
  const page = await optional(
    'recently viewed',
    getApi().getProducts({ ids: input.data, limit: input.data.length }),
    null,
  );
  return page?.items ?? [];
}
