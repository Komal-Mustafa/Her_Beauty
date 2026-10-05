import { getApi } from '@hb/sdk';
import { Slug, type Category } from '@hb/types';
import { cache } from 'react';

/** One category read per request, shared by the layout, `generateMetadata` and the page. */
export const loadCategory = cache(async (slug: string): Promise<Category | null> => {
  // A slug that cannot exist is a 404 without a round trip to the API.
  if (!Slug.safeParse(slug).success) return null;
  return getApi().getCategory(slug);
});
