'use client';

import { ActiveFilters } from './active-filters';
import { FilterDrawer } from './filter-drawer';
import { SortSelect } from './sort-select';

/**
 * Above the grid: below 1024 px the Filters button and Sort share a row; from 1024 px (filters in
 * the sidebar) Sort sits on the right. Applied filter chips follow underneath.
 */
export function ListingToolbar() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterDrawer className="md:hidden" />
        <SortSelect id="listing-sort" className="ml-auto" />
      </div>
      <ActiveFilters />
    </div>
  );
}
