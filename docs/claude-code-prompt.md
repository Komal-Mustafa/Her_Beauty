# Claude Code Prompt — Her Beauty 3D Motion Premium Website

> How to use:
> 1. Put the whole `docs/` folder in your repo as `/docs` (00-README … 09-runbook, rules, security, memory).
> 2. Put the logo at `/docs/assets/hb-logo.png` (SVG if you have it).
> 3. Start Claude Code in the repo, press **Shift+Tab** to enter **Plan Mode**, and paste the **MASTER PROMPT** below.
> 4. Approve the plan, then give the **PHASE PROMPTS** one at a time. Review and commit after each phase.

---

## MASTER PROMPT (paste this first)

```
You are a senior creative front-end engineer and 3D web developer (Three.js / React Three Fiber / GSAP), working like an award-winning studio (Awwwards / FWA level). Build the customer-facing website and seller portal UI for "Her Beauty (HB)" — a premium multi-vendor beauty marketplace.

## Read first (source of truth)
Read these files fully before planning. If anything I say here conflicts with them, the docs win — tell me about the conflict.
- /docs/memory.md        → project summary + decisions (read FIRST)
- /docs/01-prd.md            → features, seller types, plans, ad packages
- /docs/03-app-web-flow.md   → journeys and screens
- /docs/04-ui-ux-design.md   → PINK/GOLD/WHITE tokens, fonts, layouts (§6), motion (§7), 3D art direction (§8)
- /docs/02-trd.md            → stack + monorepo layout + API
- /docs/rules.md             → coding rules (must follow)
- /docs/security.md      → frontend security items (CSP, XSS, uploads)
- /docs/assets/hb-logo.png → logo

## Goal
A luxury, cinematic, 3D-motion website that feels like a high-end cosmetics brand launch film — but stays FAST and works on mid-range Android phones on 4G.
Feel: elegant, feminine, glowing, soft, premium. Slow and smooth motion. Never loud, never cluttered.

## Tech stack (use exactly this)
- Next.js 15 App Router + TypeScript (strict), inside the Turborepo layout from 02-trd.md §3
  (build in apps/web for storefront, apps/seller for seller portal, shared UI in packages/ui, tokens in packages/config)
- Tailwind CSS with brand tokens from 04-ui-ux-design.md §2 (no random hex codes in components)
- React Three Fiber + @react-three/drei + @react-three/postprocessing (subtle bloom only)
- GSAP + ScrollTrigger for scroll-driven scenes; Lenis for smooth scroll (synced with ScrollTrigger)
- Framer Motion for UI micro-interactions (buttons, cards, page transitions)
- detect-gpu for device tier; zod for forms; shadcn/ui primitives restyled to the brand
- Fonts via next/font: Playfair Display (headings), Cormorant Garamond (small-caps eyebrows), Inter (body)

## Data
There is NO backend yet. Create a typed mock data layer in packages/types + apps/web/lib/mock:
products (with shades/variants, some with video, some with 3D), vendors & manufacturers, categories, reviews, ad packages (Glow/Radiance/Luxe/Icon from 01-prd.md §7.6), ad slots.
All data access goes through an `api/` client with functions (getProducts, getProduct, getAdSlots…) so we can swap mocks for the real NestJS API later without touching components.

## 3D assets
We don't have 3D models yet. Build PROCEDURAL placeholder models in code:
- Lipstick: LatheGeometry case (gold metal, MeshPhysicalMaterial, clearcoat) + pink bullet with a slanted tip
- Blush compact: rounded box base + hinged lid with mirror (MeshReflectorMaterial or env map) + pink powder pan
- Perfume bottle and cream jar (bonus)
- Soft floating petals (instanced mesh) and light dust particles
Wrap each in a <Model> component that loads a .glb if `src` is given, else the procedural version, so real models drop in later.
Use one small HDRI / Environment preset ("studio" or "apartment") for reflections. Gold metal = #D4AF37, lipstick pink = #C2185B, soft pink = #F8BBD9, background white → blush #FFF5F9.

## Signature experiences (from the client's sketch)
1. "4D CINEMATIC" HERO (home, top) — scroll-driven 3D film, pinned for ~400vh on desktop:
   - Scene 1 (0–25%): white canvas, HB logo draws in with a gold line, gold dust
   - Scene 2 (25–50%): camera glides; lipstick + compact float up, slow rotation, light sweep across metal
   - Scene 3 (50–75%): tagline "Her Beauty, Her Story" in Playfair; featured vendor products orbit in
   - Scene 4 (75–100%): featured ADVERTISED product lands center-stage with "Shop now" CTA
   - Hero content (featured ad product, tagline) must come from data (it is a paid "hero" ad slot)
2. LEFT STICKY PANEL — "3D Display Advertisement": rotating 3D product, drag-to-rotate, "Sponsored" label, CTA
3. RIGHT STICKY PANEL — "Video Advertisement": muted autoplay loop (poster first), "Sponsored" label, CTA
   (desktop ≥1280px: sticky side columns; tablet/mobile: become full-width cards between sections)
4. PRODUCT PAGE 3D VIEWER — tab in gallery: Images | Video | 3D. Drag rotate, pinch zoom, auto-rotate, shade picker changes the lipstick bullet color live (from variant shade_hex)

## Pages to build
Storefront (apps/web):
- / (home): header/nav, cinematic hero, category circles, trending carousel, new arrivals, top brands ("Official Brand" badge for manufacturers), offers banner, side ad panels, footer
- /category/[slug] and /search: filters (brand, category, price, skin type, rating), sponsored products marked
- /product/[slug]: gallery (images/video/3D), shade picker, price, add to cart, "Payment protected until delivery" trust badge, delivery estimate per vendor, reviews, more from this seller
- /store/[slug]: seller storefront with badge, banner, products
- /cart and /checkout (UI only; shipping shown per vendor; payment step = placeholder button)
- /orders/[id]/track: order tracking stepper (Paid → Packed → Shipped → In transit → Delivered)
- /advertise: marketing page for brands (why sell & advertise, package preview, CTA)
- /login, /register (customer), wishlist
Seller portal (apps/seller) — UI with mock data, see 04-ui-ux-design.md §6.5:
- /login, /login/2fa, /forgot-password, /verify
- /register: 9-step wizard, step ① Vendor vs Manufacturer cards, step ④a Manufacturer details / ④b Vendor brand authorizations, autosave, save & continue later
- /application-status
- /dashboard overview, /ads, /ads/packages (pricing page with billing toggle, live "seats left", comparison table, "where your ad appears" mini preview), /ads/subscribe/[package] wizard, /ads/calendar

## Motion rules
- Easing cubic-bezier(0.22, 1, 0.36, 1); UI 150–250ms; hero 600–1200ms. Nothing bouncy or flashy.
- Page transitions: soft fade + slight upward move. Section reveals on scroll (stagger text lines).
- Magnetic hover on main CTAs; product card hover = image zoom 1.04 + second image fade in.
- Custom cursor (small gold ring) on desktop only; off for touch.

## Performance budget (MUST pass)
- Lighthouse mobile ≥ 90 performance on / and /product/[slug]; LCP < 2.5s; CLS < 0.05; INP < 200ms
- Initial JS for home < 250 KB gzipped; all 3D code dynamically imported (ssr:false) and loaded after first paint
- LCP element = static hero poster image/text (NOT the canvas); canvas fades in when ready
- Device tiers via detect-gpu:
  - high: full 3D + bloom + particles
  - mid: 3D without postprocessing, fewer particles, DPR max 1.5
  - low / prefers-reduced-motion / Save-Data: NO WebGL — short HLS/MP4 hero loop + static images
- Pause render loops when off-screen (frameloop="demand" / IntersectionObserver); only one WebGL canvas active at a time where possible
- Dispose geometries/materials on unmount; no memory leaks when navigating
- next/image everywhere with sizes; every video has a poster and preload="none" below the fold

## Quality rules
- Follow /docs/rules.md (TypeScript strict, no any, no console.log, tokens only)
- Accessibility WCAG 2.1 AA: keyboard navigation, focus rings (pink-400), alt text, aria labels on 3D viewers ("3D view of … drag to rotate"), pause button for moving hero/video, text contrast per 04-ui-ux-design.md
- Security (security.md): sanitize any rich text with DOMPurify, no dangerouslySetInnerHTML without it, strict CSP-ready (no inline scripts except nonce), no secrets in frontend
- SEO: metadata per page, OG images, schema.org Product JSON-LD, sitemap
- Mobile-first; test at 360px, 768px, 1280px, 1920px
- Ads always show a "Sponsored" label

## How to work
1. First: produce a PLAN only — folder structure, component list, scene breakdown for the hero, which libraries, and the phase order below. Wait for my approval.
2. Work phase by phase. After each phase: run lint + typecheck + build, fix all errors, and give me a short summary (what's done, how to see it, what's next).
3. Don't install extra libraries beyond the stack without asking.
4. If something in the docs is unclear or marked [CONFIRM], use a sensible default, leave `// TODO [CONFIRM]:` in code, and list it in your summary.
5. After each phase, update /docs/memory.md "Current status".

Phases:
P1 Setup: monorepo, Tailwind tokens, fonts, packages/ui base components (Button, Card, Badge, Input, Modal, Stepper, ShadePicker), mock data + api client, layout (header/footer), Lenis + GSAP setup, device-tier hook
P2 3D foundation: <Canvas> wrapper with tiering, procedural Lipstick/Compact/Perfume/Jar models, Environment, petals/particles, <Model> glb-or-procedural loader, 3D product viewer
P3 Cinematic hero: 4 scroll scenes, poster/video fallback, reduced-motion, pause control
P4 Home page: all sections + sticky 3D ad (left) + video ad (right) + mobile layout
P5 Catalog: category/search, product page (gallery + 3D tab + live shade change), store page
P6 Cart, checkout UI, order tracking page
P7 Seller portal: login/2FA/forgot/verify, 9-step registration wizard (Vendor/Manufacturer), application status
P8 Ads: /advertise, /ads/packages, subscribe wizard, calendar, ads overview
P9 Polish: page transitions, cursor, micro-interactions, accessibility pass, SEO, Lighthouse ≥ 90 fixes, cross-device check

Start now with the PLAN for all phases. Do not write code yet.
```

---

## PHASE PROMPTS (send one at a time after approving the plan)

**P1**
```
Approved. Do P1 (Setup) now. Finish with lint + typecheck + build passing, then summarize and stop.
```

**P2**
```
Do P2 (3D foundation). Make the procedural lipstick and compact look premium: gold metal with clearcoat, soft studio reflections, pink bullet. Add a /dev/3d playground page where I can see each model and switch device tiers. Build must pass. Summarize and stop.
```

**P3**
```
Do P3 (Cinematic hero). Follow 04-ui-ux-design.md §6.1 hero scenes exactly. The LCP must be the static poster/text, not the canvas. Test reduced-motion and low-tier fallback. Record the Lighthouse mobile score for / in your summary. Stop after.
```

**P4 → P9**
```
Do P[N] as in the plan. Same rules: build passes, docs updated, summary, stop.
```

---

## FIX / REVIEW PROMPTS (useful anytime)

**Performance check**
```
Run a performance review of apps/web: bundle sizes per route, Lighthouse mobile for / and /product/[slug], WebGL draw calls and FPS on the hero (mid tier). List the top 5 problems with fixes, then apply them.
```

**Premium feel pass**
```
Review the site like an Awwwards judge. Where does it feel cheap, busy, or template-like? Compare against 04-ui-ux-design.md (colors, spacing, typography, motion). Give 10 specific improvements, then implement the top 5.
```

**Accessibility check**
```
Do an accessibility audit (WCAG 2.1 AA): keyboard-only navigation through home, product page, checkout, and registration wizard; screen-reader labels on 3D viewers; contrast; motion pause controls. Fix everything you find.
```

**Swap in real 3D models later**
```
I added real .glb files in apps/web/public/models/. Replace the procedural models with them using the <Model> component, compress with gltf-transform (Draco/meshopt + KTX2), keep each under 2 MB, and keep procedural as fallback if loading fails.
```
