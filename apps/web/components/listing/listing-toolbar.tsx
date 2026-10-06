'use client';

import { ActiveFilters } from './active-filters';
import { FilterDrawer } from './filter-drawer';
import { SORT_SELECT_ID } from './ids';
import { SortSelect } from './sort-select';

/**
 * Above the grid: below 1024 px the Filters button and Sort share a row; from 1024 px (filters in
 * the sidebar) Sort sits on the right. Applied filter chips follow underneath.
 */
export function ListingToolbar() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <FilterDrawer className="shrink-0 px-3 sm:px-4 md:hidden" />
        <SortSelect id={SORT_SELECT_ID} className="ml-auto min-w-0" />
      </div>
      <ActiveFilters />
    </div>
  );
}
