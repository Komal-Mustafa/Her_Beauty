import { getApi } from '@hb/sdk';
import { Slug, type Product } from '@hb/types';
import { cache } from 'react';

/** One product read per request, shared by the layout, `generateMetadata` and the page. */
export const loadProduct = cache(async (slug: string): Promise<Product | null> => {
  // A slug that cannot exist is a 404 without a round trip to the API.
  if (!Slug.safeParse(slug).success) return null;
  return getApi().getProduct(slug);
});
