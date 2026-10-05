import { formatMoney } from '@hb/sdk/format';
import { PK_CITIES, type DeliveryEstimate, type PkCity, type Province } from '@hb/types';

/*
 * Words of the delivery panel (docs/p5-catalog.md §5 "Delivery estimate"): the city list grouped
 * by province and the one-line estimate. Pure, so the copy is unit-tested.
 */

/** What the panel gets back from the server action: an estimate, or nothing to show. */
export type DeliveryEstimateResult = { ok: true; estimate: DeliveryEstimate } | { ok: false };

export const PROVINCE_LABEL: Record<Province, string> = {
  punjab: 'Punjab',
  sindh: 'Sindh',
  kpk: 'Khyber Pakhtunkhwa',
  balochistan: 'Balochistan',
  islamabad: 'Islamabad Capital Territory',
  gilgit_baltistan: 'Gilgit-Baltistan',
  ajk: 'Azad Jammu and Kashmir',
};

export type CityGroup = { province: Province; label: string; cities: PkCity[] };

/** `PK_CITIES` as option groups, in the list's own order (Punjab and Islamabad first). */
export const CITY_GROUPS: readonly CityGroup[] = PK_CITIES.reduce<CityGroup[]>((groups, city) => {
  const group = groups.find((g) => g.province === city.province);
  if (group) group.cities.push(city.name);
  else {
    groups.push({
      province: city.province,
      label: PROVINCE_LABEL[city.province],
      cities: [city.name],
    });
  }
  return groups;
}, []);

/** "2–4 days", "1 day". */
export function deliveryDays({ daysMin, daysMax }: DeliveryEstimate): string {
  if (daysMin === daysMax) return `${daysMin} ${daysMin === 1 ? 'day' : 'days'}`;
  return `${daysMin}–${daysMax} days`;
}

/**
 * The estimate after the days: fee, free-shipping minimum and cash on delivery. Without a rate
 * for the zone the fee is "Delivery fee confirmed at checkout".
 */
export function deliveryTerms({ fee, freeShippingMin, codAvailable }: DeliveryEstimate): string[] {
  const terms = [
    fee === null
      ? 'Delivery fee confirmed at checkout'
      : fee === 0
        ? 'Free delivery'
        : formatMoney(fee),
    freeShippingMin !== null && fee !== 0 ? `free over ${formatMoney(freeShippingMin)}` : null,
    codAvailable ? 'Cash on delivery available' : 'No cash on delivery',
  ];
  return terms.filter((t) => t !== null);
}

/** "2–4 days · Rs 250 · free over Rs 3,000 · Cash on delivery available". */
export function deliveryLine(estimate: DeliveryEstimate): string {
  return [deliveryDays(estimate), ...deliveryTerms(estimate)].join(' · ');
}
