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
- **B1 Backend foundation — done (PR open).** `packages/db`: Prisma schema for all 55 tables in 05-database-schema.md, one init migration with CHECKs, partial indexes and RLS; seed builds the demo catalogue from the storefront fixtures. `apps/api`: NestJS read API for categories, brands, products (filters, sort, cursor), product detail, reviews, stores, ads serving, hero scenes, ad packages, plans. Storefront switches with `NEXT_PUBLIC_API_MODE=http`.
- **B2 Accounts + login — done (PR open).** Design: docs/b2-auth.md. API `/v1/auth/*`, `/v1/me`, `/v1/me/contacts/*`, `/v1/seller/*`, `/v1/admin/overview`: register (customer / vendor / manufacturer), email or mobile code, password login, 2FA (TOTP + backup codes, required for admin), refresh-token rotation with reuse detection, lockout, CAPTCHA per IP, device list, password reset, confirm email / mobile when signed in. Default-deny guard + roles + seller scope (RLS). `packages/auth` = server-only BFF helpers, edge middleware and shared auth UI; login pages in all three apps (web `/login` `/register` `/account`, seller `/login` `/register` `/security` `/dashboard`, admin `/login` + 2FA enrolment + overview). Reviewed from 3 angles; 24 findings fixed (pre-hijacking, open redirect, spoofed IPs, lockout race…). 117 API tests, 122 BFF tests, 114 real-browser checks.
- Next: P4 home sections + sidebar ads, or B3 (seller onboarding wizard P7 backend).
- Full phase list P1–P11: docs/frontend-plan.md §9. Backend phases B1… run alongside.
- Real product photos: storefront still uses placeholder SVGs. Unsplash/Pexels are blocked by the environment's network policy; need client photos or the hosts allowlisted.

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
| 2026-09-26 | Backend started before P4 (client asked "make backend") | Storefront can move to real data early; API contract = `@hb/types` |
| 2026-09-26 | API runs on tsx (esbuild), legacy decorators, explicit `@Inject(Class)` everywhere | No `emitDecoratorMetadata` under esbuild; no build step needed |
| 2026-09-26 | RLS reads `NULLIF(current_setting('app.seller_id', true), '')::uuid` | Unset setting is `''` after a reset; plain cast would error. API must connect as non-owner role in staging/prod |
| 2026-09-26 | Media key `procedural:<kind>` = 3D model with no .glb; keys starting `/` or `http` returned as-is, others prefixed with `MEDIA_BASE_URL` | Same procedural fallback as the frontend; R2/CDN later |
| 2026-09-26 | UUIDv7 made in app code, monotonic per process | Sort by id = insertion order (variants keep the seller's shade order) |
| 2026-09-26 | Storefront hides products/ads/stores of sellers not `approved` or soft-deleted | Suspending a seller must take their listings down at once |
| 2026-09-26 | Seed orders/reviews have no payments or ledger postings | Demo history only; seed refuses to run with NODE_ENV=production |
| 2026-09-26 | Auth tokens: EdDSA JWT (15 min) + opaque refresh token (HMAC at rest, rotated, reuse ⇒ all sessions revoked, 10 s grace for races) | Short-lived stateless access, revocable sessions |
| 2026-09-26 | Browser never sees tokens: Next server actions + httpOnly cookies `hb_<app>_at/_rt` (`__Host-` in prod), SameSite Strict for admin | XSS can't steal tokens; three apps on one host don't clash |
| 2026-09-26 | Only an identifier the owner proved is a credential; a phone typed at sign-up next to an email waits in `pending_phone` | Stops registration pre-hijacking and number squatting |
| 2026-09-26 | Signed-in "confirm my email / mobile" uses `/v1/me/contacts/*`, codes bound to the account | A second identifier can be proven without ever signing anyone in |
| 2026-09-26 | Admin 2FA is mandatory (enrolled at first sign-in); customers/sellers opt in | Admin can move money and take listings down |
| 2026-09-26 | Messages (SMS/email) go to the API log in dev; real providers later [CONFIRM provider] | No provider accounts yet |

## Open [CONFIRM] items
- Real logo SVG (placeholder monogram in `packages/ui/src/components/logo.tsx`); logo ring text reads "HER BEAUTY IN".
- Who provides hero content / fallback MP4 (PRD §14 Q7).
- Plan + ad package prices, seats, upload limits, guest checkout, DRAP documents.
- Self-host detect-gpu benchmark data for strict CSP.
- Nonce CSP vs static rendering — decide in P11 with measurements.
