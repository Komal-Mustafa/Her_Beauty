import { getApi } from '@hb/sdk';
import { Slug, type Brand } from '@hb/types';
import { cache } from 'react';

/** One brand read per request, shared by the layout, `generateMetadata` and the page. */
export const loadBrand = cache(async (slug: string): Promise<Brand | null> => {
  // A slug that cannot exist is a 404 without a round trip to the API.
  if (!Slug.safeParse(slug).success) return null;
  return getApi().getBrand(slug);
});
