# Her Beauty (HB)

Premium multi-vendor beauty marketplace for Pakistan — pink · gold · white, cinematic 3D storefront, vendor & manufacturer portal, admin console.

All product, technical and design decisions live in [`docs/`](docs/00-README.md). Start with [`docs/memory.md`](docs/memory.md), then [`docs/frontend-plan.md`](docs/frontend-plan.md) for the build phases.

## Apps & packages

| Path | What | Dev URL |
|---|---|---|
| `apps/web` | Customer storefront | http://localhost:3000 |
| `apps/seller` | Vendor + manufacturer portal | http://localhost:3001 |
| `apps/admin` | Admin console | http://localhost:3002 |
| `apps/api` | NestJS REST API (`/v1`): catalogue, stores, reviews, ads, plans, home highlights, accounts + login | http://localhost:4000/v1 |
| `packages/db` | Prisma schema (55 tables), migrations with RLS, seed | – |
| `packages/auth` | Login for the three apps: server-only API helpers, cookies, middleware, shared auth UI | – |
| `packages/ui` | Brand components (Button, Badge, ProductCard, Carousel, Marquee, CountUp…) | – |
| `packages/three` | 3D: device tiers, models, viewer, hero, sidebar ad stage (P2–P4) | – |
| `packages/sdk` | `getApi()` data client — mock data or the real API (`NEXT_PUBLIC_API_MODE`) | – |
| `packages/types` | zod schemas shared by every app (money = integer paisa) | – |
| `packages/config` | tsconfig, eslint, Tailwind 4 brand theme | – |

## Run it

```bash
corepack enable          # uses pnpm from package.json
pnpm install
pnpm dev                 # all three apps
pnpm --filter @hb/web dev  # just the storefront
```

### Backend (API + database)

```bash
docker compose -f infra/docker-compose.yml up -d postgres   # Postgres 16 on :5432
cp .env.example .env                                         # DATABASE_URL etc.
export DATABASE_URL=postgresql://hb:hb@localhost:5432/herbeauty
pnpm --filter @hb/db migrate:deploy                          # create tables + RLS
pnpm --filter @hb/db seed                                    # demo catalogue, stores, reviews, ads
pnpm --filter @hb/api dev                                    # http://localhost:4000/v1/health
```

Point the storefront at it with `NEXT_PUBLIC_API_MODE=http` in `apps/web/.env.local`
(default `mock` keeps working without a database). API tests (`pnpm --filter @hb/api test`)
run against the seeded database and are skipped when `DATABASE_URL` is not set.

### Accounts and login

Design: [`docs/b2-auth.md`](docs/b2-auth.md). The apps talk to the API through their own server
(server actions + httpOnly cookies), so they need `API_INTERNAL_URL` (or
`NEXT_PUBLIC_API_BASE_URL`) and the API running. In development every SMS and email, including
one-time codes, is written to the API log (`[dev sms to …]`).

Demo accounts come from the seed when you set a password for them (never committed):

```bash
SEED_DEMO_PASSWORD='choose-one' SEED_ADMIN_EMAIL=you@example.com pnpm --filter @hb/db seed
```

| App | Log in with |
|---|---|
| Shop (`/login`) | `ayesha@hb.test`, `sana@hb.test`, `mehwish@hb.test`, `hira@hb.test` or `fatima@hb.test`, or any mobile number with a code |
| Seller portal (`/login`) | `owner@<store-slug>.test`, e.g. `owner@rose-house.test` |
| Admin (`/login`) | the `SEED_ADMIN_EMAIL` account; the first sign-in sets up two-step verification |

Behind a proxy or CDN, set `TRUSTED_PROXY_HOPS` / `CLIENT_IP_HEADER` on the Next apps and
`TRUST_PROXY` on the API so rate limits see the visitor's real IP (see `.env.example`). With
`NEXT_PUBLIC_API_MODE=http`, set the same `STOREFRONT_API_KEY` on the web app and the API, so the
shop's server-side catalogue reads are not rate-limited as one visitor.

Checks (same as CI): `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

Fonts are self-hosted in `packages/config/fonts` (OFL-1.1), so builds need no network access.

Add `?tier=high|mid|low` to any storefront URL to force a 3D device tier while testing.

Dev previews (hidden in production unless `NEXT_PUBLIC_ENABLE_DEV_PAGES=true`): `/dev/3d` models,
`/dev/ui` product cards, carousel, marquee and counters, `/dev/ads` the sidebar ads. The video ad
placeholder is rendered from our own 3D stage by `apps/web/scripts/render-ad-loop.mjs`.
