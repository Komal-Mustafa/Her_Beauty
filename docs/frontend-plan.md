# Her Beauty (HB) — Frontend Build Plan (storefront + seller portal)

> Status: **PLAN for approval — no code written yet.** Follows `claude-code-prompt.md` (P1–P11).
> Sources read: 00-README, 01-prd, 02-trd, 03-app-web-flow, 04-ui-ux-design, 05-database-schema, 06-implementation-plan, 07-payment-gateway, rules.md, security.md, logo JPEG.
> Not provided: `memory.md`, `08-website-documentation.md`, `09-runbook.md` (see §2).
> Date: 2026-09-26

---

## 1. Scope in one paragraph

A Shopify/Amazon-style multi-vendor marketplace with **four experiences**: customer storefront (`apps/web`), vendor + manufacturer portal (`apps/seller`), and an **admin panel** (`apps/admin`) that controls sellers, products, orders, shipments, ads, plans and content. Every navigation link goes to a real page. Built first on mock data behind a typed API client, so the NestJS API (`apps/api`, `apps/worker`, `packages/db`) replaces the mocks later without touching components.

### Scope update (user, 2026-09-26)
- **Admin panel added** (was out of scope): full control of everything below.
- **Full seller dashboard**, not only login/register/ads: products, orders, **shipments with tracking the marketplace can see**, wallet, plan, settings/staff. Same portal for vendors and manufacturers; manufacturers also get **Brands & authorizations** (approve vendors who resell their brand).
- **Shipment tracking visible to the marketplace**: seller books on their own courier or enters tracking; customer sees it per parcel; admin sees every shipment with status, late/failed flags.
- **Ad placements**: hero (4D), **left and right sidebars that run down the lower home sections**, category banners, sponsored products. **Ad subscriptions** (Glow/Radiance/Luxe/Icon) bought in the seller portal, approved and scheduled in admin.
- **Every nav link has a page**: account (profile, addresses, orders, wishlist), brand pages, about, FAQ, contact, policies, become a seller.
- Real money, real tracking and real admin actions need the backend track (API + DB + gateway + courier adapters), which follows these UI phases (06-plan M1–M6).

---

## 2. Conflicts and gaps found (docs win — my default in bold)

| # | Where | Conflict | Default I'll use |
|---|---|---|---|
| C1 | prompt vs 04-ui-ux §5 + 02-trd §6.1 + DB enum | Order stepper: prompt says *Paid → **Packed** → Shipped…*; design + state machine say *Paid → **Accepted** → Shipped → In transit → Delivered* | **Accepted** (matches `seller_order_status`) |
| C2 | prompt vs 02-trd §3 | Prompt puts 3D in `apps/web` and mocks in `packages/types` + `apps/web/lib/mock`; TRD has `packages/three` and `packages/sdk` | **3D in `packages/three`** (seller login also uses the compact); **API client + mock adapter in `packages/sdk`** (both apps need mocks); zod schemas/types in `packages/types` |
| C3 | 02-trd §2 vs 04-ui-ux §2.5 | TRD says **Tailwind 4**; design gives a Tailwind 3-style JS preset | **Tailwind 4**, tokens as CSS `@theme` in `packages/config/tailwind/theme.css` with exactly the §2.1 values; JS preset kept only if a tool needs it |
| C4 | logo vs 04-ui-ux §8 / prompt | Logo metal is **rose-gold/copper**; spec gold is yellow `#D4AF37`. Logo "HB" is berry `#8E1B4F`, UI primary `#C2185B` (design doc already notes this) | **Use spec tokens** (`#D4AF37`, `#C2185B`). Flagged for client — see Q2 |
| C5 | logo | Ring text reads **"HER BEAUTY IN"** — looks like a truncated/generated word | Use **"Her Beauty"** everywhere in UI; flagged — see Q2 |
| C6 | security.md §9 CSP vs perf | Nonce CSP forces every page to render dynamically (no static/ISR HTML), which fights the Lighthouse ≥ 90 target | **P1: CSP-ready code (no inline scripts, no `dangerouslySetInnerHTML` without DOMPurify). P11: nonce CSP via middleware on dynamic routes; hash-based/strict headers on static ones.** Final call in P11 with measurements |
| C7 | 06-plan M3 vs prompt | M3 exit says Lighthouse ≥ 85; prompt says ≥ 90 | **≥ 90** (stricter) |
| C8 | 03-flow site map vs prompt page list | Site map has **Brand page**, **Order success**, **Account/Addresses**, **About/FAQ/Policies**; prompt doesn't list them | **Add `/brand/[slug]` (reuses store layout) and `/checkout/success` + `/orders/[id]/return` "confirming…" state in P5/P6.** Account/info pages stay out unless you want them |
| C9 | prompt | Prompt says "Framer Motion" | Same library now published as **`motion`** (`motion/react`); I'll use that |
| C10 | README / prompt | `memory.md` is "read FIRST" and must be updated each phase, but wasn't uploaded; 08 and 09 also missing | **Create `docs/memory.md`** with a "Current status" + decision log in P1. Please upload the originals if they exist |

---

## 3. Open [CONFIRM] items that affect early phases

| Blocks | Item | Default if no answer (marked `// TODO [CONFIRM]`) |
|---|---|---|
| P1, P3 | **Logo SVG** (04-ui-ux §11). Scene 1 "gold line draws the HB logo" needs vector paths; a JPEG can't be line-drawn | I hand-build a placeholder **HB monogram SVG** (Playfair-based H + B) for the header and the draw-in; swap for the real SVG later |
| P3 | **Hero content source** (PRD §14 Q7): client video or our 3D scenes? Also the **low-tier fallback loop** (MP4) | Our procedural 3D scenes; low tier gets a **static poster sequence** (still frames rendered from our scene) until a real MP4 exists |
| P4, P8 | Ad package prices/seats (PRD §7.6), plan prices/limits (§7.5) | Use PRD numbers as mock data |
| P6 | Guest checkout with phone OTP (F-CU-02) | Show "Continue with phone OTP" UI in checkout |
| P7 | Upload limits (security §10), which sellers need DRAP docs (PRD §14 Q6) | image 5 MB · video 200 MB · 3D 8 MB · KYC 10 MB; DRAP as optional doc |
| — | Hosting budget (TRD §2) | Not needed until deploy |

---

## 4. Folder structure

```
her-beauty/
├─ apps/
│  ├─ web/                          # herbeauty.pk
│  │  ├─ app/
│  │  │  ├─ (shop)/layout.tsx       # announcement bar, header, footer, Lenis provider
│  │  │  ├─ (shop)/page.tsx         # home
│  │  │  ├─ (shop)/category/[slug]/ · search/ · product/[slug]/ · store/[slug]/ · brand/[slug]/
│  │  │  ├─ (shop)/cart/ · checkout/ · checkout/success/ · orders/[id]/track/ · wishlist/
│  │  │  ├─ (shop)/advertise/ · become-a-seller/
│  │  │  ├─ (shop)/account/ (profile · addresses · orders · orders/[id] · wishlist · reviews · settings)
│  │  │  ├─ (shop)/about/ · faq/ · contact/ · policies/[slug]/ (terms, privacy, refund, shipping)
│  │  │  ├─ (auth)/login/ · register/ · verify/
│  │  │  ├─ dev/3d/                 # P2 playground (excluded from prod build via env flag)
│  │  │  ├─ sitemap.ts · robots.ts · opengraph-image.tsx · not-found.tsx · error.tsx
│  │  ├─ components/                # page-level sections (home/, product/, cart/, checkout/, tracking/)
│  │  ├─ lib/                       # formatting (PKR from paisa), seo/json-ld, analytics stubs
│  │  └─ public/  posters/ · videos/ · models/ (future .glb)
│  └─ seller/                       # seller.herbeauty.pk
│     ├─ app/
│     │  ├─ (auth)/login/ · login/2fa/ · forgot-password/ · verify/
│     │  ├─ register/[step]/        # 9-step wizard, one route per step
│     │  ├─ application-status/
│     │  └─ (portal)/layout.tsx     # sidebar + top bar (plan badge, usage meter)
│     │     ├─ dashboard/ · products/ · products/new/ · products/[id]/
│     │     ├─ orders/ · orders/[id]/ (accept, pack, book shipment)
│     │     ├─ shipping/ (courier accounts, rates) · shipments/ · shipments/[id]/ (tracking timeline)
│     │     ├─ wallet/ · payouts/ · plan/ · brands/ (manufacturer: brands + authorization requests)
│     │     ├─ ads/ · ads/packages/ · ads/subscribe/[package]/ · ads/calendar/ · ads/creatives/ · ads/stats/
│     │     └─ settings/ · settings/staff/ · reviews/
│     └─ components/  wizard/ · ads/ · shell/ · orders/ · shipping/
│  └─ admin/                        # admin.herbeauty.pk
│     ├─ app/(auth)/login/ · login/2fa/
│     └─ app/(panel)/ overview/ · sellers/ (applications queue, [id] review) · brands/ · products/ (moderation)
│        · orders/ · shipments/ (all parcels, late/failed flags, courier health) · disputes/ · payouts/
│        · reconciliation/ · ads/ (creative approval, slot calendar, packages & seats) · cms/hero/ · cms/pages/
│        · categories/ · plans/ · users/ · settings/ · audit/
├─ packages/
│  ├─ config/     # tsconfig bases, eslint config, tailwind theme.css (tokens), postcss
│  ├─ ui/         # brand components (shadcn/Radix primitives restyled), motion tokens, icons
│  ├─ three/      # Canvas wrapper, device tiering, procedural models, <Model>, viewer, hero scenes
│  ├─ types/      # zod schemas + TS types mirroring 05-database-schema (money = integer paisa)
│  └─ sdk/        # api client interface + mock adapter + fixtures (swap to HTTP adapter later)
├─ docs/          # the spec docs + assets/hb-logo.(svg|png) + memory.md
├─ turbo.json · pnpm-workspace.yaml · package.json · .env.example · .gitignore
```

---

## 5. Component list

**packages/ui** (P1, grown per phase): Button (primary · gold · secondary · ghost, magnetic option) · IconButton · Input · Textarea · Select · Checkbox · RadioCard (payment/plan cards) · Label/FieldError · Card · ProductCard · Badge (Verified Seller · Official Brand · Sponsored · 3D chip) · ShadePicker · Stepper (order + wizard progress) · Modal/Dialog · Drawer · Tabs · Tooltip · Toast · Skeleton · EmptyState · Price (tabular, from paisa) · Rating · TrustStrip · SectionHeading (eyebrow + Playfair) · Reveal (scroll stagger) · PauseButton · Carousel · Container/Grid · Logo (SVG) · CustomCursor (desktop only).

**packages/three** (P2–P3): `useDeviceTier()` (detect-gpu + reduced-motion + Save-Data) · `<TieredCanvas>` (DPR caps, `frameloop="demand"`, IntersectionObserver pause, single-active-canvas registry, dispose on unmount) · `<StudioEnvironment>` (one small HDRI + warm key + pink rim) · procedural `Lipstick`, `Compact` (hinged lid + mirror), `Perfume`, `CreamJar`, `MarblePedestal` · `Petals` + `GoldDust` (instanced, count by tier) · `<Model src?>` (glb via useGLTF, else procedural; error → procedural) · `<ProductViewer>` (drag/pinch/auto-rotate/arrow keys/reset, live `shadeHex`) · `<Ad3DPanel>` · `hero/` scenes + GSAP timeline binding · `<BloomLite>` (high tier only).

**apps/web sections**: AnnouncementBar · Header (search, categories menu, wishlist, cart count, account) · MobileNav · Footer · CinematicHero · HeroFallback · CategoryCircles · TrendingCarousel · NewArrivals · OfficialBrands · OfferBanner · ReviewsTrust · StickyAdLeft (3D) / StickyAdRight (video) + mobile in-feed variants · FilterPanel · SortBar · ProductGrid · Gallery (Images | Video | 3D) · BuyBox · DeliveryEstimate · SellerCard · Reviews · StoreHeader · CartBySeller · CheckoutSteps (Address → Delivery → Payment) · OrderSummary · ParcelTracker (per seller) · AdvertiseLanding.

**apps/seller**: AuthSplitLayout (3D compact left) · OtpInput · TwoFactorForm · WizardShell (gold progress, autosave indicator, "Save & continue later") · steps ①–⑨ (TypeCards Vendor/Manufacturer, Account, Business, ManufacturerDetails ④a, BrandAuthorizations ④b, Documents upload, Bank (skippable), Shipping (skippable), PlanPicker, Review) · ApplicationStatus (under review / changes needed / rejected + reason / approved) · PortalShell (sidebar, plan badge, usage meter) · DashboardStats · PackageCards (Glow/Radiance/Luxe/Icon) + BillingToggle + SeatsLeft + ComparisonTable + WhereYourAdAppears mini-map · SubscribeWizard (products → calendar days → creatives → review → pay placeholder) · SlotCalendar · AdsOverview (stats) · ProductTable + ProductEditor (variants/shades, media, 3D upload, plan-limit meter) · OrderTable + OrderDetail (accept / pack / book shipment / enter tracking) · CourierConnect (key shown as `••••1234`) · RatesEditor · ShipmentTimeline · WalletCards (Held / Available / Paid out) · PayoutRequest (2FA) · BrandAuthorizations (manufacturer approves/declines vendor requests) · StaffRoles.

**apps/admin**: AdminShell (denser, white + ink) · DataTable (filters, cursor paging) · ApplicationReview (docs viewer, checklist, approve / request changes / reject with reason) · BrandProtection · ProductModeration · OrderInspector · **ShipmentsMonitor** (every parcel, courier, last event, late/failed flags, per-seller shipping quality) · DisputeCase · PayoutRun (4-eyes) · ReconciliationIssues · CreativeApproval · SlotCalendar (all slots) · HeroSceneEditor · PlanAndPackageEditor · UserRoles · SettingsForm · AuditLog · DangerZone (reason required).

**Ad placements on home**: hero (Icon) · left sticky 3D panel + right sticky video panel that **stay beside the lower sections** (categories → trending → brands → new arrivals → offers) on ≥1280px, rotating between booked advertisers · category banners · "Sponsored" product cards in grids and search.

---

## 6. Cinematic hero — scene breakdown

Pinned section, **400vh on desktop**, **~200vh "short" version on mobile mid/high tier** (hero area 80vh per 04 §6.1), one GSAP master timeline scrubbed by ScrollTrigger (Lenis drives the scroller; `lenis.on('scroll', ScrollTrigger.update)` + GSAP ticker).

| Scroll | Scene | Camera / 3D | DOM layer | Ease / timing |
|---|---|---|---|---|
| 0–25% | **1 · Logo** | White canvas; gold stroke draws HB monogram (SVG `stroke-dashoffset` on DOM layer, not WebGL, so it's also the fallback); gold dust drifts in | Eyebrow "HER BEAUTY" fades in | ease-soft, cinema 800–1200ms feel |
| 25–50% | **2 · Objects** | Slow dolly-in; lipstick + compact rise from below, gentle Y rotation; a light sweep (animated spotlight / env rotation) crosses the gold metal; background white → blush | Logo scales down to top-left | no fast spins |
| 50–75% | **3 · Story** | Camera arcs 20°; 3 featured vendor products orbit in on a ring (procedural or glb) | "Her Beauty, Her Story" in Playfair with rose-gradient fill, lines staggered | |
| 75–100% | **4 · Featured ad** | Orbit collapses; the **paid hero ad product** lands center on marble pedestal, pink rim light | Product name, brand, price, **Shop now** (pink) + **Sponsored** label | CTA is a real link at all times |

- **Data**: `sdk.getHeroScenes()` → mirrors `cms_hero_scenes` (+ `campaign_id` for the paid Icon ad); featured products from `sdk.getAdSlots('hero')`.
- **LCP**: server-rendered poster image (`next/image priority`) + H1 text. Canvas is `dynamic(..., { ssr:false })`, mounted after `requestIdleCallback`, fades in over the poster when the first frame renders.
- **Tiers**: high = full scene + subtle bloom + ~120 petals/dust · mid = no postprocessing, DPR ≤ 1.5, ~40 particles · low / reduced-motion / Save-Data = **no WebGL**: poster + static scene stills (and the MP4 loop when it exists), no pinning, content stacked normally.
- **Controls**: visible Pause/Play (stops auto motion & particles; scroll still works), keyboard-reachable Skip-hero link, all scene text also in DOM for screen readers.
- **Budget**: hero assets ≤ 3 MB total (TRD §8); canvas paused when out of view.

---

## 6b. Animation catalogue (whole site)

Rules from 04 §7: slow and smooth, ease `cubic-bezier(0.22,1,0.36,1)`, UI 150–250ms, drawers 450ms, hero 800–1200ms, only `transform`/`opacity`, nothing bouncy. `prefers-reduced-motion` = opacity fades only, no autoplay.

| Where | Animation | Phase |
|---|---|---|
| Whole site | Page transitions (soft fade + 12px rise); Lenis smooth scroll; section headings reveal line by line; images fade in as they load | P1, P11 |
| Header | Shrinks and gains a soft shadow on scroll; mega-menu slides down with staggered items; cart count ticks up when an item is added | P1, P6 |
| Home hero | 4-scene 3D film (gold logo line-draw, floating lipstick + compact, light sweep on metal, orbiting products, featured product lands) | P3 |
| Home sections | Category circles rise in with a gold ring that draws on hover; trending carousel with drag inertia; brand logos in a slow marquee; offer banner with gold shimmer sweep; counters (orders, sellers) count up | P4 |
| Sidebar ads | Left: slowly rotating 3D product, drag to spin; right: muted video loop; both crossfade between advertisers | P4, P9 |
| Product cards | Lift + shadow, image zoom 1.04 + second image crossfade, shade dots slide up, "Add to cart" slides in | P4 |
| Product page | Gallery tab slide; 3D auto-rotate; shade change smoothly re-tints the lipstick; add-to-cart "fly to cart" thumbnail; sticky buy bar slides in on mobile | P5 |
| Cart & checkout | Items slide out on remove; steps slide horizontally; payment cards glow gold when selected; success page draws a gold checkmark + soft petal burst | P6 |
| Order tracking | Stepper fills in pink step by step; current step pulses; timeline events stagger in | P6 |
| Seller portal | Login page 3D compact slowly opens; wizard progress bar fills gold; "Saved" autosave tick; dashboard numbers count up; charts draw in | P7, P8 |
| Ads pages | Package cards rise in; Icon card has a slow gold shimmer border; "seats left" pulses when low; billing toggle slides prices | P9 |
| Admin | Minimal and fast: rows fade in, drawers slide, toasts slide from the corner (no decorative motion) | P10 |
| Micro-interactions | Magnetic main CTAs; gold ring cursor on desktop; button press scale 0.98; wishlist heart fills with a small burst; skeleton shimmer while loading | P1–P11 |

Budget: motion code is lazy-loaded; no animation may push Lighthouse below 90 or cause layout shift. Pause buttons on the hero and videos.

---

## 7. Libraries

**From the spec stack (will install):** next 15, react 19, typescript (strict), turbo, pnpm, tailwindcss 4, three, @react-three/fiber, @react-three/drei, @react-three/postprocessing, gsap (+ScrollTrigger), lenis, motion (Framer Motion), detect-gpu, zod, shadcn/ui (copied source), dompurify.

**Needed but not explicitly named — asking for approval:**
| Package | Why |
|---|---|
| @radix-ui/* (per component), class-variance-authority, clsx, tailwind-merge | shadcn/ui's own dependencies |
| lucide-react | icons (shadcn default); gold/pink via tokens |
| react-hook-form + @hookform/resolvers | wizard + checkout forms with zod (could hand-roll instead) |
| eslint 9 + typescript-eslint + eslint-config-next, prettier | lint gate required after every phase |
| vitest + @testing-library/react | unit tests for money formatting, tier logic, wizard state |
| @playwright/test | P11 cross-device smoke + a11y checks (with @axe-core/playwright) |
| @lhci/cli | Lighthouse CI numbers for P3/P11 summaries |

Not planned: hls.js (use MP4 until real HLS exists), any carousel/date library (Embla/date-fns only if you approve later).

---

## 8. Data layer

- `packages/types`: zod schemas for Product, Variant (shade_hex), Media (image/video/model3d), Seller (vendor | manufacturer, badges), Brand, Category, Review, AdPackage, AdSlot (`hero | left_3d | right_video | category_banner | sponsored_product`), HeroScene, Cart, SellerOrder (status enum from DB), Plan. **Money = integer paisa** (rules §1.2), formatted only at render.
- `packages/sdk`: `HbApi` interface (`getProducts`, `getProduct`, `getCategories`, `getStore`, `getBrand`, `search`, `getAdSlots`, `getHeroScenes`, `getAdPackages`, `getSellerDashboard`, `getAdCalendar`, cart ops, `getOrder`…) with a **mock adapter** now and an HTTP adapter later; fixtures ≈ 40 products / 8 sellers (mix vendor + manufacturer) / 8 categories / reviews / 4 packages with seats.
- Server Components call the SDK directly; client state (cart, wishlist) in a small React context persisted to localStorage until the API exists.

---

## 9. Phase order and exit criteria

Every phase ends with `pnpm lint && pnpm typecheck && pnpm build` green, `docs/memory.md` "Current status" updated, and a short summary (done · how to see it · TODO [CONFIRM]s · next).

| Phase | Delivers | Exit check |
|---|---|---|
| **P1 Setup** | Monorepo, Tailwind 4 tokens, next/font (Playfair, Cormorant, Inter), packages/ui base (Button, Card, Badge, Input, Modal, Stepper, ShadePicker, Toast, Skeleton), types + sdk mocks, shop layout (announcement, header, footer, mobile nav), Lenis+GSAP provider, `useDeviceTier`, placeholder HB SVG, `.env.example`, memory.md | Both apps boot; header/footer at 360/768/1280/1920 |
| **P2 3D foundation** | TieredCanvas, StudioEnvironment, Lipstick/Compact/Perfume/Jar/Pedestal, Petals/GoldDust, `<Model>`, ProductViewer, **/dev/3d playground** with tier switcher | Viewer keyboard + pinch work; no leaks on route change (heap check) |
| **P3 Cinematic hero** | 4 scenes, poster LCP, low-tier stills, reduced-motion, pause | Lighthouse mobile score for `/` recorded; LCP element = poster/text |
| **P4 Home** | All sections, sticky left 3D ad + right video ad (≥1280px), in-feed cards on mobile, Sponsored labels | Home initial JS < 250 KB gz |
| **P5 Catalog + site pages** | /category, /search (filters, sponsored marked), /product (gallery + 3D tab + live shade), /store, /brand, JSON-LD; customer account (profile, addresses, orders, wishlist); about, FAQ, contact, policies, become-a-seller | Shade change updates 3D live; no dead links in header/footer |
| **P6 Cart & checkout** | Cart grouped by seller, 3-step checkout (payment = placeholder, COD card shown), success/"confirming…" state, /orders/[id]/track per-parcel stepper | Never shows "paid" from redirect (rules §1.6, UI mirrors it) |
| **P7 Seller portal auth + wizard** | login/2FA/forgot/verify, 9-step wizard with ④a/④b branch (Vendor / Manufacturer), autosave, save & continue later, application status | Wizard fully keyboard-operable, resumes after reload |
| **P8 Seller dashboard** | Dashboard, products (editor, variants, media, plan limits), orders (accept/pack/ship), shipping settings, shipments + tracking, wallet/payouts, plan, reviews, settings/staff; manufacturer brands & authorizations | Vendor and manufacturer see the right menus; plan-limit reached state |
| **P9 Ads** | /advertise, packages (billing toggle, seats, comparison, slot preview), subscribe wizard, calendar, creatives, stats; storefront slots wired to booked ads | Waitlist state when seats = 0; every ad shows "Sponsored" |
| **P10 Admin panel** | Login + 2FA, overview, seller applications, brands, product moderation, orders, **shipments monitor**, disputes, payouts, reconciliation, ad approvals + calendar + packages, hero CMS, pages, categories, plans, users/roles, settings, audit | Money/danger actions require a reason; every list filterable |
| **P11 Polish** | Page transitions, cursor, micro-interactions, a11y pass (axe), SEO (metadata, OG, sitemap), CSP/headers, Lighthouse ≥ 90 on `/` and `/product/[slug]`, 360–1920 check | LCP < 2.5s, CLS < 0.05, INP < 200ms |

Git (rules §9): branch per phase (`feat/p1-setup` …), conventional commits, one PR per phase, screenshots in PR.

---

## 10. What I need from you

1. **Repository:** use an existing GitHub repo (name it) or create a new one (suggest `her-beauty`)?
2. **Brand:** yellow gold `#D4AF37` (spec) or rose gold to match the logo? And is the logo text really "HER BEAUTY IN"?
3. **Logo SVG** from the designer if it exists (otherwise I build a placeholder monogram).
4. **Approve the extra libraries** in §7 (or tell me which to drop).
5. `memory.md`, `08`, `09` if they exist.
6. Then: "Approved, do P1."

**Backend track after P11** (06-plan M1–M6): NestJS API + Postgres (05 schema), auth/2FA, payments (07), courier adapters + tracking webhooks, escrow ledger, ad serving — swapping `packages/sdk` mocks for the HTTP adapter screen by screen.
