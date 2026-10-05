import { getApi } from '@hb/sdk';
import { Slug, type Store } from '@hb/types';
import { cache } from 'react';

/** One store read per request, shared by the layout, `generateMetadata` and the page. */
export const loadStore = cache(async (slug: string): Promise<Store | null> => {
  // A slug that cannot exist is a 404 without a round trip to the API.
  if (!Slug.safeParse(slug).success) return null;
  return getApi().getStore(slug);
});
