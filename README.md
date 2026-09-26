# Her Beauty (HB)

Premium multi-vendor beauty marketplace for Pakistan — pink · gold · white, cinematic 3D storefront, vendor & manufacturer portal, admin console.

All product, technical and design decisions live in [`docs/`](docs/00-README.md). Start with [`docs/memory.md`](docs/memory.md), then [`docs/frontend-plan.md`](docs/frontend-plan.md) for the build phases.

## Apps & packages

| Path | What | Dev URL |
|---|---|---|
| `apps/web` | Customer storefront | http://localhost:3000 |
| `apps/seller` | Vendor + manufacturer portal | http://localhost:3001 |
| `apps/admin` | Admin console | http://localhost:3002 |
| `packages/ui` | Brand components (Button, Badge, Stepper, ShadePicker…) | – |
| `packages/three` | 3D: device tiers, models, viewer, hero (P2–P3) | – |
| `packages/sdk` | `getApi()` data client — mock data now, NestJS API later | – |
| `packages/types` | zod schemas shared by every app (money = integer paisa) | – |
| `packages/config` | tsconfig, eslint, Tailwind 4 brand theme | – |

## Run it

```bash
corepack enable          # uses pnpm from package.json
pnpm install
pnpm dev                 # all three apps
pnpm --filter @hb/web dev  # just the storefront
```

Checks (same as CI): `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

Behind a TLS-inspecting proxy, set `NODE_EXTRA_CA_CERTS` so `next/font` can download Google Fonts at build time.

Add `?tier=high|mid|low` to any storefront URL to force a 3D device tier while testing.
