'use client';

import type { ProductFacets, SellerType, ShadeFamily, SkinType } from '@hb/types';
import { Button, cn } from '@hb/ui';
import { Fragment, useId, useState, type FormEvent, type ReactNode } from 'react';
import {
  LISTING_FILTERS,
  LISTING_RUPEES_MAX,
  listingSearchParams,
  paisaToRupees,
  productCount,
  toggled,
  withChange,
  type ListingFilter,
  type ListingParams,
} from '@/lib/listing-url';
import {
  CheckboxList,
  FilterGroup,
  RadioList,
  ShadeSwatches,
  visibleOptions,
} from './filter-group';
import { useListing } from './listing-context';

/** Brands listed before "Show all {n} brands" (docs/p5-catalog.md §2.1). */
const BRANDS_SHOWN = 8;

type FilterPanelProps = {
  /** Keeps ids unique when the sidebar and the drawer both exist. */
  idPrefix: string;
  className?: string;
};

/**
 * The filter groups of a listing page (docs/p5-catalog.md §2.1): only the groups the page offers
 * and that have options; options without products are hidden unless ticked. Every change applies
 * at once. The panel is also a plain GET form, so without JavaScript "Apply filters" submits it.
 */
export function FilterPanel({ idPrefix, className }: FilterPanelProps) {
  const { kind, path, params, facets, apply } = useListing();
  const set = (change: Partial<ListingParams>) => apply(withChange(params, change));

  // The search text and the sort ride along when the form is submitted without JavaScript.
  const keep = listingSearchParams({ ...params, page: 1 });
  const hidden = [...keep.entries()].filter(([key]) => key === 'q' || key === 'sort');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  const groups: Record<ListingFilter, () => ReactNode> = {
    category: () => {
      const options = visibleOptions(facets.categories, (v) => v === params.category);
      return options.length ? (
        <FilterGroup legend="Category">
          <RadioList
            name="category"
            anyLabel="All categories"
            options={options}
            selected={params.category}
            onSelect={(category) => set({ category })}
          />
        </FilterGroup>
      ) : null;
    },
    brand: () => {
      const options = visibleOptions(facets.brands, (v) => params.brand.includes(v));
      return options.length ? (
        <FilterGroup legend="Brand">
          <CheckboxList
            name="brand"
            options={options}
            selected={params.brand}
            onToggle={(b) => set({ brand: toggled(params.brand, b) })}
            limit={BRANDS_SHOWN}
            noun="brands"
          />
        </FilterGroup>
      ) : null;
    },
    shade: () => {
      const options = visibleOptions(facets.shades, (v) => params.shade.includes(v as ShadeFamily));
      return options.length ? (
        <FilterGroup legend="Shade">
          <ShadeSwatches
            options={options}
            selected={params.shade}
            onToggle={(s) => set({ shade: toggled(params.shade, s as ShadeFamily) })}
          />
        </FilterGroup>
      ) : null;
    },
    skin: () => {
      const options = visibleOptions(facets.skinTypes, (v) => params.skin.includes(v as SkinType));
      return options.length ? (
        <FilterGroup legend="Skin type">
          <CheckboxList
            name="skin"
            options={options}
            selected={params.skin}
            onToggle={(s) => set({ skin: toggled(params.skin, s as SkinType) })}
          />
        </FilterGroup>
      ) : null;
    },
    type: () => {
      const options = visibleOptions(facets.sellerTypes, (v) => v === params.type);
      return options.length ? (
        <FilterGroup legend="Seller">
          <RadioList
            name="type"
            anyLabel="All sellers"
            options={options}
            selected={params.type}
            onSelect={(type) => set({ type: type as SellerType | undefined })}
          />
        </FilterGroup>
      ) : null;
    },
    price: () =>
      facets.price || params.min !== undefined || params.max !== undefined ? (
        <FilterGroup legend="Price">
          <PriceFilter
            idPrefix={idPrefix}
            params={params}
            range={facets.price}
            onApply={(min, max) => set({ min, max })}
          />
        </FilterGroup>
      ) : null,
    rating: () => {
      const options = visibleOptions(facets.ratings, (v) => v === String(params.rating));
      return options.length ? (
        <FilterGroup legend="Rating">
          <RadioList
            name="rating"
            anyLabel="Any rating"
            options={options}
            selected={params.rating === undefined ? undefined : String(params.rating)}
            onSelect={(r) => set({ rating: r === '4' ? 4 : r === '3' ? 3 : undefined })}
            display={(o) => `${o.value}★ & up`}
          />
        </FilterGroup>
      ) : null;
    },
    sale: () =>
      facets.onSale > 0 || params.sale ? (
        <FilterGroup legend="Offers">
          <SaleSwitch
            count={facets.onSale}
            checked={params.sale}
            onChange={(sale) => set({ sale })}
          />
        </FilterGroup>
      ) : null,
  };

  return (
    <form
      action={path}
      method="get"
      noValidate
      onSubmit={onSubmit}
      className={cn('flex flex-col', className)}
    >
      {hidden.map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      {LISTING_FILTERS[kind].map((filter) => (
        <Fragment key={filter}>{groups[filter]()}</Fragment>
      ))}
      <noscript>
        <div className="py-4">
          <Button type="submit" block>
            Apply filters
          </Button>
        </div>
      </noscript>
    </form>
  );
}

/** Digits of a typed price ("1,500" → 1500); null when it is not a whole number of rupees. */
function typedRupees(text: string): number | null | undefined {
  const digits = text.replace(/[\s,]/g, '');
  if (digits === '') return undefined;
  if (!/^\d{1,9}$/.test(digits)) return null;
  const value = Number(digits);
  return value <= LISTING_RUPEES_MAX ? value : null;
}

type PriceFilterProps = {
  idPrefix: string;
  params: ListingParams;
  range: ProductFacets['price'];
  onApply: (min: number | undefined, max: number | undefined) => void;
};

/**
 * Min and Max in whole rupees (the API gets paisa), applied with the Apply button or Enter. The
 * placeholders show the cheapest and dearest price of the current results.
 */
function PriceFilter({ idPrefix, params, range, onApply }: PriceFilterProps) {
  const text = (rupees: number | undefined) => (rupees === undefined ? '' : String(rupees));
  const [min, setMin] = useState(text(params.min));
  const [max, setMax] = useState(text(params.max));
  const [error, setError] = useState(false);
  // A new URL (Apply, a chip removed, Back) puts its prices back in the inputs. Adjusted while
  // rendering instead of remounting, so focus stays on the Apply button.
  const [shown, setShown] = useState({ min: params.min, max: params.max });
  if (shown.min !== params.min || shown.max !== params.max) {
    setShown({ min: params.min, max: params.max });
    setMin(text(params.min));
    setMax(text(params.max));
    setError(false);
  }
  const ids = { min: `${idPrefix}-min`, max: `${idPrefix}-max`, error: useId() };

  function submit() {
    const low = typedRupees(min);
    const high = typedRupees(max);
    if (low === null || high === null) {
      setError(true);
      return;
    }
    setError(false);
    const swap = low !== undefined && high !== undefined && low > high;
    onApply(swap ? high : low, swap ? low : high);
  }

  const input =
    'h-11 w-full min-w-0 rounded-btn border border-ink-200 bg-white px-3 text-sm text-ink-900 tabular-nums transition duration-fast placeholder:text-ink-500 focus:border-pink-600 focus:outline-none focus:ring-4 focus:ring-pink-100 aria-invalid:border-danger';
  const field = (key: 'min' | 'max', label: string, value: string, change: (v: string) => void) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={ids[key]} className="text-xs font-medium text-ink-500">
        {label}
      </label>
      <input
        id={ids[key]}
        name={key}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={
          range
            ? String(key === 'min' ? paisaToRupees(range.min) : paisaToRupees(range.max, true))
            : ''
        }
        aria-invalid={error || undefined}
        aria-describedby={error ? ids.error : undefined}
        className={input}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-3 px-2">
      <div className="flex items-end gap-2">
        {field('min', 'Min (Rs)', min, setMin)}
        <span aria-hidden className="pb-3 text-ink-500">
          –
        </span>
        {field('max', 'Max (Rs)', max, setMax)}
      </div>
      {error ? (
        <p id={ids.error} className="text-sm text-danger">
          Enter whole rupees, like 1500.
        </p>
      ) : null}
      <Button type="button" variant="secondary" size="sm" className="h-11" onClick={submit}>
        Apply price
      </Button>
    </div>
  );
}

type SaleSwitchProps = { count: number; checked: boolean; onChange: (on: boolean) => void };

/** "On sale only" switch: a checkbox with the switch role, the knob slides (transform). */
function SaleSwitch({ count, checked, onChange }: SaleSwitchProps) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-btn px-2 transition-colors duration-fast hover:bg-blush-50">
      <input
        type="checkbox"
        role="switch"
        name="sale"
        value="1"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span aria-hidden className="min-w-0 flex-1 text-sm text-ink-900">
        On sale only
        <span className="ml-2 text-xs tabular-nums text-ink-500">
          {count.toLocaleString('en-PK')}
        </span>
      </span>
      <span className="sr-only">On sale only, {productCount(count)}</span>
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-pill bg-ink-200 transition-colors duration-base ease-soft peer-checked:bg-pink-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pink-400 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-pill after:bg-white after:shadow-soft after:transition-transform after:duration-base after:ease-soft peer-checked:after:translate-x-5 motion-reduce:after:transition-none"
      />
    </label>
  );
}
