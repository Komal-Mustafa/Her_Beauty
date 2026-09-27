# P4 — Home sections and sidebar ads

Design for phase P4 (docs/frontend-plan.md §9: "All sections, sticky left 3D ad + right video ad
(≥1280px), in-feed cards on mobile, Sponsored labels"; exit check: home initial JS < 250 KB gz).
Sources: 04-ui-ux-design §4–§7 and §6.1, frontend-plan §5 and §6b, PRD §7.6.

## 1. Page structure

```
Hero (P3, unchanged)
┌ ≥1280px ────────────────────────────────────────────────────────────┐
│ left rail 240 │ centre column                      │ right rail 240 │
│ sticky 3D ad  │ 1 Shop by category (circles)        │ sticky video ad│
│ (top below    │ 2 Trending now (carousel)           │                │
│  the header)  │ 3 Official brands (marquee)         │                │
│               │ 4 New arrivals (grid)               │                │
│               │ 5 Offer banner (grad-rose)          │                │
│               │ 6 Loved by shoppers (reviews, trust,│                │
│               │   counters)                         │                │
└───────────────┴─────────────────────────────────────┴────────────────┘
Footer (P1, unchanged)
```

- The rails run from section 1 to section 6 and stay `position: sticky` beside them. The whole row
  is at most 1440 px (hero width, 04 §4): two 240 px rails, 32 px gaps and the page gutters leave
  the centre column 688 px wide at 1280 and at most 848 px. Without rails (below 1280) the column
  is the full content width. Sections therefore size by the column (container queries), not the
  viewport, and the trending carousel does not bleed into the gutter next to the rails.
- Below 1280 px the rails are not rendered visible; the same ads appear as full-width in-feed cards:
  the 3D ad after section 1 and the video ad after section 2 (04 §6.1 "Mobile").
- Both variants may exist in the DOM; the hidden one is `display: none` (out of the a11y tree), and
  heavy media (WebGL canvas, video) only start when their element is actually visible.

## 2. Sections (centre column)

| # | Section | Data | Look and motion (04 §5–§7, plan §6b) |
|---|---|---|---|
| 1 | Shop by category | `getCategories()` | Circles (echo the round logo), rise in with stagger; on hover/focus a **gold ring draws** around the circle (SVG stroke-dashoffset), image zoom 1.05. Links `/category/{slug}` |
| 2 | Trending now | `getProducts({ sort: 'best_selling', limit: 12 })` | `Carousel` of `ProductCard`s; drag with inertia (mouse), native swipe (touch), prev/next buttons, snap. Sponsored products keep their label |
| 3 | Official brands | `getFeaturedBrands()` then `getBrands()` | Gold-bordered round logos in a slow **marquee**; featured brands (paid Luxe = "featured", Icon = "top") come first and carry **Sponsored**. Pauses on hover/focus; reduced motion = static wrapped row. Links `/brand/{slug}` |
| 4 | New arrivals | `getProducts({ sort: 'newest', limit: 8 })` | Grid 2 cols (mobile) → 3 (≥768) → 4 (≥1024 centre width permitting); cards reveal with stagger |
| 5 | Offer banner | house promo (not an ad) | `grad-rose` panel, Playfair headline, gold button; **gold shimmer sweep** once when it scrolls into view and once per hover |
| 6 | Loved by shoppers | `getFeaturedReviews(3)`, `getStorefrontStats()` | Up to 3 review cards, one per shopper (stars, title, quote, name, "Verified purchase", product link); counters (verified sellers, official brands, products, orders delivered) **count up** once when visible. The footer's `TrustStrip` follows straight after, so this section does not repeat it |

Headings use `SectionHeading` (eyebrow + Playfair). Every section is a `<section aria-labelledby>`.

## 3. Sidebar ads (slots `left_3d`, `right_video`)

Data: `getAdSlots('left_3d')`, `getAdSlots('right_video')` → `ServedAd[]` (server component fetch).

Common shell (`AdCard`): white card, radius 20, 1 px gold-500 border (premium), **Sponsored** badge
(always, PRD §7.6), seller name (ink-500), headline (Playfair), CTA button that is a real link to
`ad.href`. Width 240 in the rail, full width in-feed (media 4:5 in rail, 16:9 / 4:3 in-feed).

Rotation: when a slot has several ads they **crossfade** (opacity only, 450 ms) every 8 s. Rotation
pauses while hovered, focused, off-screen, tab hidden, or when the shopper pressed Pause; with
`prefers-reduced-motion` there is no auto-rotation (dots let the shopper switch). Dots are buttons
(`aria-label="Show ad 2 of 3"`, ≥44 px hit area). Screen readers are not spammed (no live region).

- **Left — 3D display ad.** A small R3F stage (`@hb/three/3d`, loaded with `next/dynamic`, ssr off)
  showing the ad's procedural model (`media.model3dKind`, `media.shadeHex`) on the marble pedestal,
  slowly auto-rotating; **drag to spin** (pointer), arrow keys rotate when focused,
  `aria-label="3D view of {headline}, drag or use arrow keys to rotate"`. Mounted only when the card
  is near the viewport and the browser is idle; device tier `low`, Save-Data or reduced motion ⇒ the
  poster image (`media.posterUrl`) instead of WebGL. Uses the existing `TieredCanvas` (pauses off
  screen) so the hero and this stage never both render.
- **Right — video ad.** `<video muted loop playsInline preload="none" poster>`; plays only while
  visible and not reduced-motion; visible **Pause/Play** button (04 §10); no sound, so no captions
  track is needed (the headline is the text alternative). A placeholder loop is generated locally
  (no network) by `apps/web/scripts/render-ad-loop.mjs`: `apps/web/public/placeholders/
  video-placeholder.webm`, 8 s, 480×600, VP9, about 160 KB, rendered from our own 3D stage. There is
  no `.mp4` (the headless encoder has no H.264); a browser that cannot play WebM keeps the poster.
- **Empty slot:** a house card "Advertise with Her Beauty" → `/advertise` (not labelled Sponsored).
- Impression/click tracking is P9 (TODO in code).

## 4. Product card (`ProductCard`, packages/ui) + shop wiring

Spec 04 §5 + plan §6b: white, radius 20, 4:5 image on blush-50; hover = lift + `shadow-lift`, image
zoom 1.04 + **crossfade to the second image**; "3D" chip top-left (gold outline); `New` / `Sponsored`
badges; shade dots (max 5 + "+n") that **slide up** on hover; brand, title (2 lines), seller name
ink-500 with Verified/Official badge; rating; price pink-600 (`Price`, from paisa) with compare-at.
Whole card is one link (title link with a stretched `::after`); the wishlist heart and the cart button
sit above it.

- **Wishlist heart** fills with a small burst (scale/opacity only). `aria-pressed`.
- **Add to cart** slides in on hover/focus (always visible on touch / `hover: none`). Shown only when
  `quickAddVariantId` is set; otherwise the button is a link **Choose shade** (or **See options**) to
  the product page. Adding ticks the header cart count and shows a toast "Added to cart" with
  **View cart**.
- `packages/ui` stays presentational (`onAddToCart`, `onToggleWishlist`, `wishlisted`, `adding`
  props); `apps/web/components/product/shop-product-card.tsx` connects it to the stores.

Client stores until the cart API exists (P6 replaces the cart store's backend, keeps its API):
`apps/web/lib/cart-store.ts` and `wishlist-store.ts` — `useSyncExternalStore` over `localStorage`
(`hb_cart_v1`, `hb_wishlist_v1`), values re-validated with zod on read (never trusted), cross-tab
sync via the `storage` event, SSR snapshot = empty. Cart line: `{ variantId, productSlug, title,
image, unitPrice (paisa), qty }`, qty 1–10. Header shows the cart count (tick animation when it
rises); the count is client-only and reserves its space (no layout shift).

## 5. UI primitives (packages/ui)

- `Carousel` — horizontal track with CSS scroll-snap; native scroll (touch inertia for free), mouse
  drag with inertia (pointer events + rAF decay, cancels on wheel/keys, suppresses the click after a
  drag), prev/next buttons disabled at the ends, `role="region" aria-roledescription="carousel"`,
  items are list items; no autoplay.
- `Marquee` — CSS transform loop (duplicated track `aria-hidden`), speed prop, pauses on
  hover/focus-within, reduced motion ⇒ static, wrapped.
- `CountUp` — counts to a number once when visible (rAF, ease-soft, ~1.2 s), final value rendered on
  the server for no-JS and screen readers (`aria-label` / visually hidden final text), reduced motion
  ⇒ final value at once, tabular numerals.

## 6. Data additions (types → sdk mock + http → API)

- `getStorefrontStats(): StorefrontStats` = `{ verifiedSellers, officialBrands, products,
  ordersDelivered }` (ints). API `GET /v1/stats/storefront` (public, `max-age=300`): approved,
  not deleted sellers; protected brands whose owner (if any) is a visible seller; live products of
  visible sellers; seller orders delivered or delivered and released.
- `getFeaturedReviews(limit ≤ 12): FeaturedReview[]` = `Review` + `{ product: { slug, title } }`:
  4–5 stars with a non-empty body, from a delivered order, customer not deleted, only live products
  of visible sellers; **one quote per shopper** (their newest), picked from the newest
  `limit × 4` eligible reviews; newest first, ties by product slug then id (same pick in mock and
  http). May return fewer than `limit`. API `GET /v1/reviews/featured?limit=`.
- `getFeaturedBrands(): FeaturedBrand[]` = `Brand` + `{ placement: 'top' | 'featured' }`: protected
  brands whose owner has an `active` (not past due) subscription inside its current period, on a
  package with `featuredBrand` (`top` = Icon first, then Luxe `featured`), at most 24. API
  `GET /v1/brands/featured`. Always rendered with **Sponsored**. The slug `featured` must be
  reserved when brand creation is built.
- `ProductCard.quickAddVariantId` (done at the start of P4).

## 7. Budgets and checks

- Home first-load JS < 250 KB (Next build report). The 3D stage and the carousel's drag code are
  client chunks; three.js loads only via `next/dynamic`.
- No layout shift: every media box has a fixed aspect ratio; rails have fixed width.
- Motion: only `transform`/`opacity`, `ease-soft`, durations from tokens; reduced motion honoured
  everywhere (no autoplay, no marquee, no auto-rotation).
- A11y: visible labels, focus rings, ≥44 px targets, pause for the video and the rotation, alt text.
- Browser check at 360 / 768 / 1280 / 1920: rails only at ≥1280, in-feed below, no horizontal
  overflow, no console errors, Sponsored on every paid placement.
