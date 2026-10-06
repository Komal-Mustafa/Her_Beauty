import { z } from 'zod';
import { Money } from './common';

// Delivery estimates on the product page (docs/p5-catalog.md §3.1 and §5). Sellers ship with their
// own couriers (PRD §7.7): each has shipping_settings and per-zone shipping_rates, and a zone is
// derived from the seller's city and the shopper's city.

export const Province = z.enum([
  'punjab',
  'sindh',
  'kpk',
  'balochistan',
  'islamabad',
  'gilgit_baltistan',
  'ajk',
]);
export type Province = z.infer<typeof Province>;

type CityEntry = { name: string; province: Province; remote?: boolean };

/** Cities a shopper can pick for an estimate, grouped by province. `remote` = far courier zone. */
export const PK_CITIES = [
  { name: 'Lahore', province: 'punjab' },
  { name: 'Faisalabad', province: 'punjab' },
  { name: 'Rawalpindi', province: 'punjab' },
  { name: 'Multan', province: 'punjab' },
  { name: 'Gujranwala', province: 'punjab' },
  { name: 'Sialkot', province: 'punjab' },
  { name: 'Bahawalpur', province: 'punjab' },
  { name: 'Sargodha', province: 'punjab' },
  { name: 'Islamabad', province: 'islamabad' },
  { name: 'Karachi', province: 'sindh' },
  { name: 'Hyderabad', province: 'sindh' },
  { name: 'Sukkur', province: 'sindh' },
  { name: 'Larkana', province: 'sindh' },
  { name: 'Peshawar', province: 'kpk' },
  { name: 'Abbottabad', province: 'kpk' },
  { name: 'Mardan', province: 'kpk' },
  { name: 'Mingora', province: 'kpk' },
  { name: 'Quetta', province: 'balochistan' },
  { name: 'Gwadar', province: 'balochistan', remote: true },
  { name: 'Turbat', province: 'balochistan', remote: true },
  { name: 'Gilgit', province: 'gilgit_baltistan', remote: true },
  { name: 'Skardu', province: 'gilgit_baltistan', remote: true },
  { name: 'Muzaffarabad', province: 'ajk' },
  { name: 'Mirpur', province: 'ajk' },
] as const satisfies readonly CityEntry[];

type PkCityName = (typeof PK_CITIES)[number]['name'];

export const PkCity = z.enum(PK_CITIES.map((c) => c.name) as [PkCityName, ...PkCityName[]]);
export type PkCity = z.infer<typeof PkCity>;

export const DeliveryZone = z.enum(['same_city', 'province', 'nationwide', 'remote']);
export type DeliveryZone = z.infer<typeof DeliveryZone>;

export const DeliveryEstimate = z.object({
  city: PkCity,
  zone: DeliveryZone,
  /** Seller handling days + courier days. */
  daysMin: z.number().int().nonnegative(),
  daysMax: z.number().int().nonnegative(),
  /** null = the seller confirms the fee at checkout (no rate for this zone). */
  fee: Money.nullable(),
  freeShippingMin: Money.nullable(),
  codAvailable: z.boolean(),
});
export type DeliveryEstimate = z.infer<typeof DeliveryEstimate>;

/** One row of a seller's rate card (shipping_rates): a zone and a parcel weight band. */
export const ShippingRateBand = z.object({
  zone: DeliveryZone,
  minWeightG: z.number().int().nonnegative(),
  maxWeightG: z.number().int().positive(),
  price: Money,
  daysMin: z.number().int().nonnegative(),
  daysMax: z.number().int().nonnegative(),
});
export type ShippingRateBand = z.infer<typeof ShippingRateBand>;

/** A seller's shipping_settings plus its rate card. */
export const ShippingProfile = z.object({
  handlingDays: z.number().int().nonnegative(),
  freeShippingMin: Money.nullable(),
  codEnabled: z.boolean(),
  rates: z.array(ShippingRateBand),
});
export type ShippingProfile = z.infer<typeof ShippingProfile>;

/** What a seller without shipping_settings gets (the table's column defaults). */
export const DEFAULT_SHIPPING_PROFILE: ShippingProfile = {
  handlingDays: 1,
  freeShippingMin: null,
  codEnabled: true,
  rates: [],
};

/** Courier days when the seller has no rate for the zone nor a nationwide one. */
export const FALLBACK_COURIER_DAYS = { min: 3, max: 5 } as const;

/** Islamabad and Rawalpindi are one metro area for couriers. */
const TWIN_CITIES: readonly string[] = ['Islamabad', 'Rawalpindi'];

const cityKey = (name: string) => name.trim().toLowerCase();
const cityByKey = new Map<string, CityEntry>(PK_CITIES.map((c) => [cityKey(c.name), c]));

/** A listed city by name, ignoring case and surrounding spaces; undefined when not listed. */
export function findPkCity(name: string): CityEntry | undefined {
  return cityByKey.get(cityKey(name));
}

/** Islamabad Capital Territory counts as Punjab for courier zones. */
const zoneProvince = (c: CityEntry): Province =>
  c.province === 'islamabad' ? 'punjab' : c.province;

/**
 * Courier zone from the seller's city to the shopper's: the same city (Islamabad and Rawalpindi
 * count as one) is `same_city`, then a remote destination is `remote`, then the same province
 * (Islamabad counts as Punjab) is `province`, anything else `nationwide`. A seller city that is
 * not listed is `nationwide` (or `remote` when the destination is remote).
 */
export function deliveryZone(fromCity: string, toCity: PkCity): DeliveryZone {
  const to = findPkCity(toCity);
  const from = findPkCity(fromCity);
  if (!to) return 'nationwide';
  if (from) {
    const twin = TWIN_CITIES.includes(from.name) && TWIN_CITIES.includes(to.name);
    if (from.name === to.name || twin) return 'same_city';
  }
  if (to.remote) return 'remote';
  if (from && zoneProvince(from) === zoneProvince(to)) return 'province';
  return 'nationwide';
}

/** The lightest weight band a seller has for a zone (a single item ships in it). */
function lightestBand(rates: readonly ShippingRateBand[], zone: DeliveryZone) {
  return rates
    .filter((r) => r.zone === zone)
    .sort((a, b) => a.minWeightG - b.minWeightG || a.maxWeightG - b.maxWeightG || a.price - b.price)
    .at(0);
}

/**
 * Delivery estimate for one item from a seller in `fromCity` to `toCity`: handling days plus the
 * courier days and fee of the seller's lightest band for the zone. Without a rate for the zone
 * the fee is null (the seller confirms it at checkout) and the days fall back to the seller's
 * nationwide band, or FALLBACK_COURIER_DAYS. The API and the mock adapter both call this.
 */
export function estimateDelivery(
  fromCity: string,
  toCity: PkCity,
  profile: ShippingProfile = DEFAULT_SHIPPING_PROFILE,
): DeliveryEstimate {
  const zone = deliveryZone(fromCity, toCity);
  const band = lightestBand(profile.rates, zone);
  const days = band ?? lightestBand(profile.rates, 'nationwide');
  return {
    city: toCity,
    zone,
    daysMin: profile.handlingDays + (days?.daysMin ?? FALLBACK_COURIER_DAYS.min),
    daysMax: profile.handlingDays + (days?.daysMax ?? FALLBACK_COURIER_DAYS.max),
    fee: band ? band.price : null,
    freeShippingMin: profile.freeShippingMin,
    codAvailable: profile.codEnabled,
  };
}
