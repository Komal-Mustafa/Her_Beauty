# P5a — Catalogue pages: category, search, product, brand, store

Design for the first half of phase P5 (docs/frontend-plan.md §9: "/category, /search (filters,
sponsored marked), /product (gallery + 3D tab + live shade), /store, /brand, JSON-LD"; exit check:
"Shade change updates 3D live; no dead links in header/footer"). Sources: PRD §7.1 (F-ST-04..08),
03-app-web-flow §1, §2.1 and §7, 04-ui-ux-design §4–§10 and §6.2, 02-trd §5.1, frontend-plan §5,
§6b and §8, rules.md, security.md §XSS.

P5 is split into two PRs so each stays reviewable:

- **P5a (this document):** the catalogue. `/category/[slug]`, `/search`, `/new`, `/offers`,
  `/brands`, `/brand/[slug]`, `/store/[slug]`, `/product/[slug]`, the search and facet API, delivery
  estimates, JSON-LD and the sitemap. After P5a every product, category, brand and store link on
  the site opens a real page.
- **P5b (next):** wishlist page, account orders and addresses, about, FAQ, contact, policies and
  become-a-seller. After P5b the header and footer have no dead links except `/cart` (P6) and
  `/advertise` (P9).

## 1. Routes

| Route | H1 | Fixed filter | Default sort | Facets shown | Extra |
|---|---|---|---|---|---|
| `/category/[slug]` | category name | `category` | Bestselling | brand, shade, skin, seller type, price, rating, on sale | category banner ad (Sponsored) above the grid |
| `/search?q=` | Results for “q” | none | Relevance (with `q`), else Bestselling | category, brand, shade, skin, seller type, price, rating, on sale | no `q`: search box, category circles, trending carousel; no results: suggestions |
| `/new` | New in | `isNew` | Newest | category, brand, shade, skin, seller type, price, rating, on sale | |
| `/offers` | Offers | `onSale` | Biggest discount | category, brand, shade, skin, seller type, price, rating | rose-gradient intro band (house promo, not an ad) |
| `/brand/[slug]` | brand name | `brand` | Bestselling | category, shade, skin, seller type, price, rating, on sale | brand header (logo circle, Official Brand badge when protected, "Sold by {store}" link when the owner sells here) |
| `/store/[slug]` | store name | `seller` | Bestselling | category, brand, shade, skin, price, rating, on sale | store header (banner, logo circle, badge, Vendor/Manufacturer, city, rating, joined, product count, about) |
| `/brands` | All brands | — | — | — | featured brands first (Sponsored), then A–Z with a letter index; product count per brand |
| `/product/[slug]` | product title | — | — | — | §5 |

Unknown slugs call `notFound()` (the P1 not-found page). Every listing and the product page have a
`loading.tsx` skeleton (blush-50 blocks with shimmer) and use the shop layout's `Container`.

As built: because `loading.tsx` streams the page, the page body arrives in the streamed part, so
listing and product content need JavaScript (the skeleton is what a no-JS client sees). A route
`layout.tsx` loads the category, brand, store or product first and calls `notFound()` there, so an
unknown slug is still a real HTTP 404 and not a 200 with a not-found body.

Breadcrumbs (`nav aria-label="Breadcrumb"`, ordered list, `aria-current="page"` on the last item)
on every page except `/search`: Home › Category › Product, Home › Brands › Brand, Home › Store.

## 2. Listing pages

### 2.1 Layout

```
Breadcrumbs
[Page header: H1 · result count · (banner ad | brand/store header | intro band)]
┌ ≥1024 ──────────────────────────────────────────────────────────────┐
│ Filters 264px (sticky top-24,  │ Sort ▾ · active filter chips · Clear │
│ own scroll when taller than    │ grid 3 cols (≥1024) → 4 cols (≥1280) │
│ the viewport)                  │ Pagination                           │
└────────────────────────────────┴──────────────────────────────────────┘
<1024: [Filters (n)] button + Sort on one row → filter drawer from the left; grid 2 cols → 3 (≥768)
```

- Grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4`, gap-x 16/24, gap-y 32, cards
  are `ShopProductCard` (P4). The first 4 cards get `priority` images (LCP).
- 24 products per page. Numbered pagination (`nav aria-label="Pagination"`: Previous · 1 2 … n ·
  Next, `aria-current="page"`), plain links, so pages can be shared and
  are crawlable. Changing a filter or sort resets to page 1.
- **Filters apply at once.** Each change calls `router.push(url, { scroll: false })` inside
  `startTransition`; while pending the grid fades to 60% and gets `aria-busy="true"`. A polite live
  region announces "{n} products" after each change.
- **Mobile drawer:** Radix Dialog sliding in from the left (transform, `duration-slow`), same filter
  groups, footer button "Show {total} products" closes it. Focus returns to the Filters button.
- **Filter groups** (each a `fieldset` with `legend`, collapsible with a disclosure button):
  categories and brands (checkboxes with counts; brands over 8 get "Show all {n}"), shade (round
  swatches of each family's hex, checkbox semantics, name visible), skin type (checkboxes), seller
  type (Official brand stores = manufacturers, Resellers = vendors), price (Min and Max in rupees,
  `inputmode="numeric"`, Apply button; placeholders show the facet's min and max), rating ("4★ &
  up", "3★ & up" radios), on sale (switch). A group with no options is hidden; options with 0
  results are hidden unless selected.
- **Active chips** above the grid: one chip per applied value ("Brand: Glow ✕"), plus
  "Clear all". Fixed page filters (the category of a category page…) are never chips.
- **Sort:** native `<select>` labelled "Sort by": Relevance (search with `q` only), Bestselling,
  Newest, Price: low to high, Price: high to low, Top rated, Biggest discount.
- **Empty states** (03-flow §7): with filters → "No products match these filters" + Clear filters;
  search without results → "We couldn't find “q”" + category circles + trending carousel. EmptyState
  component (line illustration, one sentence, one CTA).
- **Sponsored:** products promoted by a live sponsored-product campaign always carry the Sponsored
  badge (P4 rule). With the default ordering (no explicit sort) the API moves up to **2** of them
  that are in the result set to the top of page 1 (§4.4). An explicit sort is never overridden.
- **Category banner ad** (`getAdSlots('category_banner', { category })`): one card above the grid,
  image left and headline + CTA right (stacked below 768), Sponsored label, links to the ad's
  `href`. No booking → nothing rendered.

### 2.2 URL parameters

Short, human-readable, parsed leniently with zod in `apps/web/lib/listing-params.ts` (an invalid
value is dropped, never an error page). Money in the URL is whole rupees; the web converts to paisa
(× 100, integers only, rules.md §1.2).

| Param | Example | API field |
|---|---|---|
| `q` | `q=matte+lipstick` (trimmed, ≤ 100 chars) | `q` |
| `category` | `category=lips` (search, new, offers, brand, store pages) | `category` |
| `brand` (repeat) | `brand=glow&brand=velvet` | `brand[]` |
| `shade` (repeat) | `shade=red&shade=nude` | `shade[]` |
| `skin` (repeat) | `skin=dry` | `skinType[]` |
| `type` | `type=manufacturer` | `sellerType` |
| `min`, `max` | `min=1000&max=3000` (rupees) | `minPrice`, `maxPrice` (paisa) |
| `rating` | `rating=4` (3 or 4) | `minRating` |
| `sale` | `sale=1` | `onSale: true` |
| `sort` | `sort=price_asc` | `sort` |
| `page` | `page=2` (1–500) | `page` |

### 2.3 SEO for listings

`generateMetadata`: title "{H1} | Her Beauty", a one-line description. Canonical is the page path
plus `?page=n` when n > 1. Pages with any filter or sort param, and every `/search` page, are
`robots: { index: false, follow: true }`. A `?page=` past the last page stays 200 with an empty
state that links back to page 1, and is `noindex, follow` too.

## 3. Data contracts

### 3.1 `@hb/types` additions (catalog.ts unless noted)

```ts
export const ShadeFamily = z.enum(['nude', 'pink', 'red', 'berry', 'coral', 'mauve', 'brown', 'gold']);
export const ProductSort = z.enum([...current, 'discount']);   // discount = biggest % off first

// ProductQuery gains:
shade: z.array(ShadeFamily).optional(),        // any variant's shade in one of these families
onSale: z.boolean().optional(),                // compareAtPrice > price
isNew: z.boolean().optional(),
ids: z.array(Id).min(1).max(50).optional(),    // exactly these products, in this order; hidden/unknown ids skipped

export const SEARCH_PAGE_SIZE = 24;
export const SEARCH_PAGE_SIZE_MAX = 48;
export const SEARCH_SPONSORED_PINS = 2;
export const SearchQuery = ProductQuery.omit({ cursor: true, limit: true, ids: true }).extend({
  page: z.number().int().min(1).max(500).optional(),
  pageSize: z.number().int().min(1).max(SEARCH_PAGE_SIZE_MAX).optional(),
});
export const FacetOption = z.object({ value: z.string(), label: z.string(), count: z.number().int().nonnegative() });
export const ShadeFacetOption = FacetOption.extend({ hex: HexColor });   // swatch colour for the family
export const ProductFacets = z.object({
  categories: z.array(FacetOption),   // value = category slug, label = name
  brands: z.array(FacetOption),       // value = brand slug, sorted by label
  shades: z.array(ShadeFacetOption),  // value = ShadeFamily, in enum order
  skinTypes: z.array(FacetOption),    // value = SkinType
  sellerTypes: z.array(FacetOption),  // value = SellerType
  ratings: z.array(FacetOption),      // value '4' and '3' = rated n and up
  onSale: z.number().int().nonnegative(),
  price: z.object({ min: Money, max: Money }).nullable(),   // null when nothing matches
});
export const SearchResult = z.object({
  items: z.array(ProductCard),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  pageCount: z.number().int().nonnegative(),
  facets: ProductFacets,
});
```

`delivery.ts` (new):

```ts
export const Province = z.enum(['punjab', 'sindh', 'kpk', 'balochistan', 'islamabad', 'gilgit_baltistan', 'ajk']);
export const PK_CITIES = [ { name: 'Lahore', province: 'punjab' }, …, { name: 'Gilgit', province: 'gilgit_baltistan', remote: true } ] as const;
export const PkCity = z.enum(/* PK_CITIES names */);
export const DeliveryZone = z.enum(['same_city', 'province', 'nationwide', 'remote']);
export function deliveryZone(fromCity: string, toCity: PkCity): DeliveryZone;
export const DeliveryEstimate = z.object({
  city: PkCity,
  zone: DeliveryZone,
  daysMin: z.number().int().nonnegative(),   // seller handling days + courier days
  daysMax: z.number().int().nonnegative(),
  fee: Money.nullable(),                     // null = the seller confirms the fee at checkout
  freeShippingMin: Money.nullable(),
  codAvailable: z.boolean(),
});
```

- Cities (about 25): Punjab: Lahore, Faisalabad, Rawalpindi, Multan, Gujranwala, Sialkot,
  Bahawalpur, Sargodha. Islamabad. Sindh: Karachi, Hyderabad, Sukkur, Larkana. KPK: Peshawar,
  Abbottabad, Mardan, Mingora. Balochistan: Quetta, Gwadar (remote), Turbat (remote).
  Gilgit-Baltistan: Gilgit (remote), Skardu (remote). AJK: Muzaffarabad, Mirpur.
- Zone rules: same city → `same_city` (Islamabad and Rawalpindi count as one city); remote
  destination → `remote`; same province → `province` (Islamabad counts as Punjab); otherwise
  `nationwide`. An unknown seller city is `nationwide` (or `remote` when the destination is remote).

### 3.2 `HbApi` additions (packages/sdk/src/api.ts), both adapters

```ts
/** GET /search — the listing engine for every listing page: filters, facets, sort, pages. */
search(query?: SearchQuery): Promise<SearchResult>;
/** GET /products/:slug/delivery?city= — null when the product is not on sale. */
getDeliveryEstimate(productSlug: string, city: PkCity): Promise<DeliveryEstimate | null>;
```

`getProducts` accepts the new `ProductQuery` fields (`shade`, `onSale`, `isNew`, `ids`, sort
`discount`), still returns `Paged<ProductCard>`, and is used for carousels. Mock and HTTP adapters
return the same data for the same fixtures (existing parity rule).

### 3.3 API (apps/api), public

| Endpoint | Notes |
|---|---|
| `GET /v1/search` | Query = `SearchQuery` (arrays comma-separated: `brand`, `skinType`, `shade`; numbers: `minPrice`, `maxPrice`, `minRating`, `page`, `pageSize`; booleans `onSale`, `isNew` as `true`/`false`). `.strict()`: unknown params → 400 `VALIDATION_FAILED`. Loads live products of visible sellers (bounded by `MAX_SCAN`), then runs the shared `runSearch` (§4). A page past the end returns `items: []` with the real `total`. |
| `GET /v1/products` | Gains `shade`, `onSale`, `isNew`, `ids`, sort `discount`. `q` uses the shared typo-tolerant matcher instead of SQL `contains`. |
| `GET /v1/products/:slug/delivery?city=` | Declared before `products/:slug`. `city` must be a `PkCity` (else 400). Uses the seller's `shipping_settings` (handling days, free-shipping minimum, COD) and the lightest `shipping_rates` band for the zone. No rate for the zone → `fee: null` with a nationwide-based day range. Product hidden or unknown → 404. |

Interim note: search and facets run in memory over at most `MAX_SCAN` (2000) live products until
Meilisearch (02-trd §2) replaces it behind the same endpoint and types. Rate limit per
security.md: search 60/min per IP (use the existing throttler). The storefront renders every
shopper's listing pages from its own server, one IP, so that server sends `STOREFRONT_API_KEY`
(header `x-hb-storefront-key`, server-only, set by `getApi`) and the API does not count its public
GETs per IP; shoppers are limited at the edge (security.md §11). Writes and signed-in routes always
count.

## 4. Shared catalogue logic (`packages/types/src/search.ts`, pure, unit-tested)

Both the mock adapter and the API call these, so the two stay identical.

1. **`normalizeText`**: lowercase, strip diacritics (Lumière → lumiere), `&` → `and`, collapse
   non-alphanumerics to single spaces.
2. **`searchScore(query, doc)`** where `doc = { title, brand, store, category, tags, shades }`:
   every query token must match some field token (AND). A token matches exactly, by prefix (last
   query token only, ≥ 2 chars, for type-ahead), or with typos: Damerau–Levenshtein ≤ 1 for tokens
   of 4–7 chars, ≤ 2 for 8+, none under 4. Score = Σ best match per token × field weight (title 4,
   brand 3, category 2, tags 2, shades 1, store 1), exact > prefix > typo. 0 = no match.
   Must pass: "lipstik" finds lipsticks; "lumiere" finds Lumière; "vitamin serum" finds only
   products with both; "velvet" ranks Velvet-brand products and "Velvet Matte Lipstick" first;
   "xyzzy" finds nothing.
3. **`shadeFamily(hex)`**: HSL rules into the 8 families; tests pin every shade in the fixtures to
   the family a person would name (Berry Kiss → berry, Nude Silk → nude, Rose Petal → pink, Coral
   Bloom → coral, Mauve → mauve, gold highlighter → gold, …). Each family has a display hex for
   swatches (`SHADE_FAMILY_HEX`) and a label (`SHADE_FAMILY_LABEL`).
4. **`discountPercent(price, compareAt)`**: integer percent, floor, 0 when not on sale. The "-n%"
   price badge uses the same rule (`@hb/types/money`; no badge under 1%), so a list sorted by
   discount never shows a bigger badge below a smaller one.
5. **`filterProducts(products, query, ctx)`** applies every `ProductQuery` filter.
   **`sortProducts(list, sort, scores?)`**: relevance = score desc (stable), newest = `isNew`
   first then input order (the API feeds rows newest first), price asc/desc, rating desc then
   rating count, best_selling = `soldCount` desc, discount = percent desc then price asc.
6. **`computeFacets(products, query, ctx)`**: disjunctive counts — each group's counts use every
   filter except that group's own, so several brands can be ticked. `price` is the min/max with
   every filter except price. Fixed page filters are passed in the query like any other.
7. **`pinSponsored(list, max = SEARCH_SPONSORED_PINS)`**: moves the first `max` sponsored products
   to the front, keeps everything else in order. Applied to the whole ordered list before paging
   (so a pinned product never appears twice) and only when `sort` is absent or `relevance`.
8. **`runSearch(products, query, ctx)`** → `SearchResult` = filter → score → sort → pin → page →
   `toProductCard`, plus facets. `ctx` carries categories (id → slug/name) and brand names.
9. **`toProductCard(product)`** replaces the two private copies (mock and API mappers).

## 5. Product page `/product/[slug]`

```
Breadcrumbs: Home › Lips › Velvet Matte Lipstick
┌ ≥1024: 60 / 40, gap 48 ─────────────────────────────────────────────────┐
│ Gallery                                  │ Buy box (sticky top-24)       │
│ [Images | Video | 3D] tabs               │ Brand eyebrow (→ /brand)      │
│ main 4:5 image, thumbnails               │ H1 title · rating (→ #reviews)│
│                                          │ Price · was · -15%            │
│                                          │ Shade picker · stock note     │
│                                          │ Qty −/+ · Add to cart · ♡     │
│                                          │ Delivery to [city ▾]: 2–4 days│
│                                          │ Seller card · Trust strip     │
└──────────────────────────────────────────┴───────────────────────────────┘
Description · How to use · Ingredients
Reviews
More from {store} (carousel) · Similar products (carousel) · Recently viewed (carousel)
<1024: gallery, then buy box, then the rest; sticky buy bar slides up once Add to cart scrolls away
```

- **Data** (server, in parallel, `optional()` for the decorative parts): `getProduct` (404 →
  `notFound`), `getReviews`, `getStore(seller.slug)`, `getProducts({ seller, limit: 12 })`,
  `getProducts({ category, sort: 'best_selling', limit: 12 })` (both minus this product),
  `getCategories` for the breadcrumb. `generateMetadata` shares the product read via React `cache`.
- **Variant from the URL:** `?shade=<shade name slug>` selects that shade on first render (shareable
  links); changing shade updates the URL with `history.replaceState` (no navigation).
- **Gallery tabs** (`Tabs` from `@hb/ui`, only tabs that have media): Images (default, first image
  is the LCP with `priority`); Video (`<video controls muted playsInline preload="none" poster>`,
  never autoplays); 3D (only when a media item has `model3dKind` or a model URL) mounts
  `ProductViewer` through `next/dynamic` with `ssr: false` the first time the tab opens. Tab change
  slides the panel 12 px + fades (transform/opacity, `duration-base`; opacity only with reduced
  motion). Below 1024 the images are a horizontal scroll-snap strip with dot indicators; from 1024
  a main image with a thumbnail row (buttons, `aria-pressed`).
- **Live shade (exit check):** the shade picker drives the viewer's `shadeHex`; the lipstick bullet
  and the compact's pan **re-tint smoothly** (colour damped over ~450 ms, then the demand frame loop
  stops; instant with reduced motion). The 3D tab label keeps the gold "3D" chip.
- **Buy box:** brand eyebrow link; H1 (34 px, 44 px from 1280: smaller than the 56 px page H1 of
  04 §3, because it sits in the 40 % buy-box column, where 56 px would put almost every title on two
  lines and push the price and Add to cart down); `Rating` + "{ratingCount} ratings" link to `#reviews`; `Price`
  with compare-at and "-n%" badge; `ShadePicker` (sold-out shades marked, still selectable to see
  them); size pills when variants differ by `sizeLabel` instead of shade; stock note ("Only 3 left"
  at ≤ 5, "Out of stock"); quantity stepper 1…min(10, stock) with − and + buttons and a labelled
  input; **Add to cart** (primary, 48 px). Out of stock → the button reads "Out of stock" disabled
  and the heart becomes "Save to wishlist" (secondary). Heart toggles the wishlist with a small
  burst. Toast as on the home page.
- **Fly to cart:** on add, a copy of the current image flies to the header cart icon
  (`[data-cart-target]`) with WAAPI transform + opacity, 600 ms `ease-soft`, then is removed. Skipped
  with reduced motion or when the header icon is off screen.
- **Delivery estimate:** "Delivery to [city ▾]" `<select>` of `PK_CITIES` (grouped by province),
  remembered in `hb_city_v1`. Result: "2–4 days · Rs 250 · free over Rs 3,000 · Cash on delivery
  available" (or "Delivery fee confirmed at checkout"). Fetched by a server action with zod
  validation; a failure shows "We couldn't get an estimate right now" and keeps the page working.
- **Seller card:** logo circle, store name (→ `/store/{slug}`), badge (Verified Seller / Official
  Brand), Vendor or Manufacturer, city, rating, "Visit store". Then `TrustStrip`.
- **Sticky buy bar (< 1024):** fixed to the bottom, slides up (transform) when the main Add to cart
  button leaves the viewport (IntersectionObserver) and hides when it returns; shows the shade dot,
  price and Add to cart. The page reserves bottom padding so it never hides content. Not rendered
  from 1024 (the buy box is sticky there).
- **Details:** Description (`descriptionHtml` sanitized on render with DOMPurify, see §7), How to
  use, Ingredients — stacked sections with h2s; missing ones are omitted.
- **Reviews (`#reviews`):** average (large), stars, "{ratingCount} ratings"; "Only shoppers who
  received this product can review it" note; review cards (stars, title, body, name, date,
  Verified purchase badge, photo thumbnails opening a lightbox `Modal`). None → "No written reviews
  yet." Stars always have text ("4 out of 5 stars").
- **Carousels:** More from {store}, Similar products (same category), Recently viewed
  (`hb_recent_v1`, newest first, max 12, this product excluded; cards fetched with
  `getProducts({ ids })` through a server action; hidden until there is at least one).
- **SEO:** metadata title "{title} by {brand} | Her Beauty", description from the plain-text
  description (≤ 160 chars), Open Graph image = first image, canonical `/product/{slug}` (without
  `?shade`). JSON-LD `Product` (name, image, description, sku, brand, `aggregateRating` when there
  are ratings, up to 5 `review`s, `offers` as `AggregateOffer` over variants with `priceCurrency`
  PKR, `lowPrice`/`highPrice` as decimal strings from paisa, availability) and `BreadcrumbList`.

## 6. Fixtures and seed

The demo catalogue grows to what the plan promised (frontend-plan §8: ≈ 40 products / 8 sellers):

- **48 products, 6 per category**, keeping the 16 existing slugs and ids (`prd-1`…`prd-16`, ads,
  hero and tests refer to them) and appending `prd-17`…`prd-48`. Realistic PKR prices (Rs 650 to
  Rs 12,000), about a third on sale, about a quarter new, two fully out of stock and a few
  sold-out shades. Lipsticks and blushes carry 4–8 shades spread across the shade families; a
  gold highlighter. Skin types on skincare, face and body. Tags carry search words ("matte",
  "long-wear", "spf", "vitamin c", "hair oil"…).
- Every product: `descriptionHtml` of a `<p>` plus a `<ul>` of 3 benefits (only tags the
  sanitizer allows), `howToUse`, a plausible INCI `ingredients` list.
- **8 sellers** (the 5 existing + 3 vendors in other cities, e.g. Peshawar, Rawalpindi, Karachi),
  **12 brands** (6 new, invented names only — never real trademarks). `Store.productCount` is
  computed from the products.
- **Reviews** on about 20 products, 2–4 each, one per demo shopper, ratings 3–5, a few with
  photos. Featured-review rules (P4) still hold.
- **Shipping profiles** per seller (handling 1–2 days, free-shipping minimum, COD on/off, a rate
  and day range per zone). The seed writes them to `shipping_settings` and `shipping_rates`; the
  mock reads the same fixture.
- **Category banners:** the mock serves a `category_banner` ad only for its product's category (as
  the seed already books it).
- **Placeholder art:** new SVGs in the existing style for kinds that have none yet: `brush`
  (tools), `tube` (body, hand cream), `mascara` (eyes), `bottle` (hair oil, toner), two views each.
- Tests that count products, sellers or brands are updated to the new numbers; a fresh seeded DB
  is used (never `migrate reset`).

## 7. Security

- `descriptionHtml` (seller-written later) is sanitized on render in a server-only helper
  (`isomorphic-dompurify`): allowed tags `p br strong em b i u ul ol li h3 h4 blockquote`, **no
  attributes**, so no `on*`, `style`, links or `javascript:`. Unit tests with hostile input.
  Very deep nesting (thousands of levels) overflows jsdom's stack and that one product page fails
  with a 500 (no XSS, no stack trace). Descriptions only come from the seed in P5a; the seller
  description editor (P7) must cap length and nesting depth when it saves.
- JSON-LD is serialised with `JSON.stringify` and `<` escaped as `<`, so product text cannot
  close the script tag.
- Every server action and API query is zod-validated; ids from localStorage are re-validated.
- Search params never reach SQL as raw strings (Prisma + in-memory matching).

## 8. Motion (plan §6b, 04 §7)

Product page: gallery tab slide, 3D auto-rotate (pauses on interaction, resumes after 4 s),
smooth shade re-tint, fly-to-cart, sticky buy bar slide, wishlist heart burst. Listings: grid cards
rise in with `Reveal` (stagger by column), filter drawer slide, pending fade. Everything is
transform/opacity with `ease-soft`; reduced motion keeps opacity fades only and no auto-rotate.

## 9. Accessibility

Filters are real form controls in fieldsets; swatches have visible names; counts are part of the
label ("Glow, 6 products"). Drawer: focus trap, Escape closes, focus returns. Live region for
result counts. Gallery thumbnails are buttons with image alt text. 3D viewer: keyboard rotation,
aria-label per 04 §10, Reset view button. Quantity stepper buttons have labels. Touch targets
≥ 44 px. Nothing hides behind the sticky header (scroll-padding from P4) or the sticky buy bar.

## 10. Performance

- Product page first-load JS < 250 KB (same budget as home); three.js only in the lazy 3D chunk.
- Listing pages are server-rendered; the only client code is the filter panel, sort and cards.
- `sitemap.ts` (revalidate hourly, static entries kept if the API is down): home, `/new`, `/offers`,
  `/brands`, categories, brands, stores, products. `robots.ts` already points to it.
- The root layout adds `WebSite` JSON-LD with a `SearchAction` to `/search?q={search_term_string}`.

## 11. Checks

- `pnpm lint && pnpm typecheck && pnpm test` and `pnpm --filter @hb/web build`.
- Unit: listing params, search scoring, shade families, facets, pinning, delivery zones, sanitizer,
  JSON-LD, stores. API: `/v1/search`, `/v1/products` new fields, delivery endpoint (zones, bad
  city 400, hidden seller 404), mock/HTTP parity for search and delivery.
- Real browser (production build, mock and HTTP modes) at 360, 768, 1024, 1280, 1440, 1920 and
  reduced motion: no horizontal scroll; filters change results and URL; back button restores;
  drawer focus; pagination; sponsored labels; product page shade → 3D colour (with `?tier=mid`);
  fly to cart; sticky bar; delivery estimate; no console errors apart from routes P5b/P6/P9 add.

## 12. Not in P5a

Wishlist page and the account pages, info pages, become-a-seller (P5b); cart and checkout (P6);
"notify me when back in stock" (needs a stock-alert table and messaging; out-of-stock products
offer Save to wishlist meanwhile); search suggestions while typing; Meilisearch; real product
photos (placeholders until photos are uploaded or the image hosts are allowed).
