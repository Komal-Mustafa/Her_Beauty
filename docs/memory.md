# memory.md — Her Beauty

> Short, always-current summary for people and AI agents. Read this first (rules.md §10).
> The original memory.md was not provided with the spec set; this file was created in P1 (2026-09-26).

## Project in 5 lines
- Premium multi-vendor beauty marketplace (Pakistan first): customers, **vendors**, **manufacturers**, **admin**.
- Money held by HB until delivery is proven (escrow-style), then released to sellers (07-payment-gateway.md).
- Sellers ship with their own couriers; HB tracks every shipment (PRD §7.7).
- Revenue: commission + selling plans + ad packages (Glow / Radiance / Luxe / Icon).
- Look: pink · gold · white, cinematic 3D hero, 3D product viewer (04-ui-ux-design.md).

## Current status
- **P1 Setup — done (PR open).** Monorepo, brand tokens, fonts, base UI kit, mock data + API client, storefront layout, seller/admin shells, CI.
- **P2 3D foundation — done (PR open).** `@hb/three/3d`: tiered canvas, studio lighting, petals + gold dust, procedural lipstick/compact/perfume/cream jar/pedestal, `<Model>` (glb with procedural fallback), `<ProductViewer>`. Playground at `/dev/3d` (dev only).
- **P3 Cinematic hero — done (PR open).** Home hero is a 4-scene scroll film (logo draw → lipstick + compact → story + orbit → paid hero ad on pedestal). `heroState()` in `@hb/three` maps scroll to scene state; `HeroScene` in `@hb/three/3d`; DOM layers + GSAP in `apps/web/components/home/cinematic-hero.tsx`. Static `HeroFallback` is the LCP and the whole hero on low tier / reduced motion.
- Next: **P4 home sections + sidebar ads**.
- Full phase list P1–P11: docs/frontend-plan.md §9. Backend track (NestJS API) follows P11.

## Decisions log
| Date | Decision | Why |
|---|---|---|
| 2026-09-26 | Scope expanded: admin panel, full vendor/manufacturer dashboard, shipment tracking, sidebar ads, every nav link a real page | Client request |
| 2026-09-26 | Order tracker shows **Accepted**, not "Packed" | Matches 04-ui-ux §5 and the seller_order_status enum |
| 2026-09-26 | 3D lives in `packages/three`, data client + mocks in `packages/sdk` | 02-trd §3; seller portal reuses both |
| 2026-09-26 | Tailwind 4 with CSS `@theme`; default Tailwind palette removed | Enforces "tokens only" (rules.md §7) |
| 2026-09-26 | 3D entry split: `@hb/three` (tier helpers, tiny) vs `@hb/three/3d` (WebGL, load via `next/dynamic` ssr:false) | Keeps three.js out of first-load JS |
| 2026-09-26 | Studio lighting built from drei Lightformers, no HDRI download | CSP connect-src stays 'self' |
| 2026-09-26 | Products without a .glb use procedural models | Every product can show 3D before sellers upload models |
| 2026-09-26 | Hero pinning uses CSS `position: sticky`, GSAP only scrubs | Robust with Lenis; no pin-spacer layout jumps |
| 2026-09-26 | Hero film mounts after `requestIdleCallback`; static hero stays the LCP | Keeps LCP fast on every device |
| 2026-09-26 | Brand gold = spec `#D4AF37` (logo art is rose-gold) | Default until client confirms |
| 2026-09-26 | `motion` package used for Framer Motion | Same library, current package name |
| 2026-09-26 | Next.js 15.5 (not 16) | TRD specifies Next 15 |

## Open [CONFIRM] items
- Real logo SVG (placeholder monogram in `packages/ui/src/components/logo.tsx`); logo ring text reads "HER BEAUTY IN".
- Who provides hero content / fallback MP4 (PRD §14 Q7).
- Plan + ad package prices, seats, upload limits, guest checkout, DRAP documents.
- Self-host detect-gpu benchmark data for strict CSP.
- Nonce CSP vs static rendering — decide in P11 with measurements.
