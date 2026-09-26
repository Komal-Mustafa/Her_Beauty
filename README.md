# Her Beauty (HB)

Premium multi-vendor beauty marketplace for Pakistan — pink · gold · white, cinematic 3D storefront, vendor & manufacturer portal, admin console.

All product, technical and design decisions live in [`docs/`](docs/00-README.md). Start with [`docs/memory.md`](docs/memory.md), then [`docs/frontend-plan.md`](docs/frontend-plan.md) for the build phases.

## Apps & packages

| Path | What | Dev URL |
|---|---|---|
| `apps/web` | Customer storefront | http://localhost:3000 |
| `apps/seller` | Vendor + manufacturer portal | http://localhost:3001 |
| `apps/admin` | Admin console | http://localhost:3002 |
| `apps/api` | NestJS REST API (`/v1`): catalogue, stores, reviews, ads, plans | http://localhost:4000/v1 |
| `packages/db` | Prisma schema (55 tables), migrations with RLS, seed | – |
| `packages/ui` | Brand components (Button, Badge, Stepper, ShadePicker…) | – |
| `packages/three` | 3D: device tiers, models, viewer, hero (P2–P3) | – |
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

Checks (same as CI): `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

Fonts are self-hosted in `packages/config/fonts` (OFL-1.1), so builds need no network access.

Add `?tier=high|mid|low` to any storefront URL to force a 3D device tier while testing.
