# Rules — Her Beauty (HB) Marketplace

> These rules are for **every developer and every AI coding agent** (Claude Code, Cursor, etc.) working on this repo.
> If a rule and a task disagree, **the rule wins** — ask before breaking one.

---

## 1. Golden rules (never break)

1. **Never store card numbers, CVV, or wallet PINs.** Payments go through the gateway's hosted page only.
2. **Money is an integer** in the smallest unit (paisa/cents). No floats, ever.
3. **Ledger entries are append-only.** Never `UPDATE` or `DELETE` a ledger row. Fix mistakes with a reversing entry.
4. **Every money change happens inside one DB transaction** with its ledger entries.
5. **A vendor can only touch its own data.** Take `vendor_id` from the auth token, never from request body/query.
6. **Never mark an order paid from the browser redirect.** Only from a verified webhook + gateway status check.
7. **Never commit secrets.** `.env` is git-ignored; use `.env.example` with fake values.
8. **Never skip validation.** Every input is validated with zod/class-validator at the API edge.

## 2. Code rules

- TypeScript `strict: true`. No `any` (use `unknown` + narrowing).
- One module = one folder: `controller`, `service`, `repository`, `dto`, `*.spec.ts`.
- Controllers are thin: validate → call service → return. Business logic lives in services.
- External services (payment, courier, storage, email) are behind **interfaces/adapters**. No gateway SDK calls outside its adapter.
- Status changes go through the **state machine** helper, never `order.status = 'x'` directly.
- Shared types come from `packages/types`. Don't copy DTOs between apps.
- Names: files `kebab-case`, classes `PascalCase`, variables `camelCase`, DB tables `snake_case` plural.
- Keep functions short (< 50 lines as a guide). Prefer clear code over clever code.
- No `console.log` in committed code — use the logger.
- Dates stored in UTC; show in user's timezone on the frontend.

## 3. API rules

- REST, versioned: `/api/v1/...`. JSON only.
- Error shape: `{ "error": { "code": "ORDER_NOT_FOUND", "message": "...", "details": {} } }`.
- Never return stack traces or DB errors to the client.
- Pagination: cursor-based for lists (`?cursor=&limit=`, max 100).
- **Idempotency-Key header required** on: create order, create payment, refund, payout request.
- Webhooks: verify signature → save to `webhook_events` (unique `event_id`) → return 200 fast → process in a queue job.
- Rate limits: login/OTP 5/min per IP+account; general API 100/min per user; search 60/min.

## 4. Database rules

- All schema changes via migrations. No manual changes in production.
- Every table has `id` (UUID v7 or cuid2), `created_at`, `updated_at` (except append-only tables).
- Foreign keys always on. Add an index for every foreign key used in filters.
- Soft delete (`deleted_at`) for products, vendors, users. Hard delete only for GDPR-style requests by admin.
- Use `SELECT ... FOR UPDATE` (or optimistic version column) when reducing stock or moving money.
- Snapshot prices, titles, addresses into order rows at checkout.

## 5. Security rules (cyber security checklist)

**Auth & access**
- Passwords: Argon2id. Min 8 chars, check against breached-password list.
- Access token 15 min; refresh token 7–30 days, rotating, stored in `httpOnly; Secure; SameSite=Lax` cookie.
- **2FA required** for vendors (before first payout) and **always** for admins.
- Lock or slow down after 5 failed logins. OTPs expire in 5 min, max 3 tries.
- RBAC on every route (`@Roles()` guard). Default = deny.
- Admin panel on a separate subdomain, optionally IP-restricted.

**OWASP Top 10**
- SQL injection: ORM / parameterized queries only. No string-built SQL.
- XSS: React escapes by default; never use `dangerouslySetInnerHTML` without sanitizing (DOMPurify). Product descriptions stored as sanitized rich text.
- CSRF: SameSite cookies + CSRF token on state-changing cookie-auth requests.
- IDOR: every "get by id" also checks owner (`WHERE id = ? AND vendor_id = ?`).
- SSRF: never fetch a URL the user gave without an allow-list.
- Security headers: CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors.

**Files**
- Uploads via short-lived signed URLs directly to storage.
- Check real file type (magic bytes), not just extension. Limits: image 5 MB, video 200 MB, 3D 8 MB **[CONFIRM]**.
- Strip EXIF from images. Virus-scan uploads.
- KYC documents in a **private** bucket; admins view through short-lived signed links; access is logged.

**Data**
- Encrypt IBAN, KYC doc keys, 2FA secrets at app level (AES-256-GCM, key in KMS/secret manager).
- TLS everywhere. DB not publicly reachable.
- Logs must not contain passwords, tokens, OTPs, full phone numbers, or bank numbers (mask them).
- Audit log for: login as admin, refund, force release, payout, plan change, vendor approve/suspend, KYC view.

**Fraud**
- Flag: many orders from one card/phone, COD orders with repeated refusal, new vendor with very high order volume, reviews from non-buyers.
- New vendors: longer hold (e.g. 14 days) for first N orders **[CONFIRM]**.
- Reviews only from verified purchases.

**Dependencies**
- `pnpm audit` / Dependabot in CI. Pin versions. Review new packages before adding.

## 6. Payment rules

- Amount sent to gateway is calculated **on the server**, never taken from the client.
- On webhook: verify signature → check amount + currency + order id match → call gateway status API → then mark paid.
- Refunds only through the `payments` service, always with a ledger reversal.
- Release job and payout job must be **safe to run twice** (idempotent).
- Daily reconciliation job: compare gateway settlement report vs our ledger; alert on any mismatch.

## 6b. Shipping rules (vendor-provided shipping)

- Vendor courier API keys are **secrets**: encrypt at rest (AES-256-GCM), never return them to any frontend (show only `••••1234`), never log them.
- Decrypt credentials **only inside the shipping module**, only for that vendor's own shipments.
- Validate credentials with the courier when the vendor connects; mark account `invalid` on auth errors and notify the vendor.
- A vendor's "mark delivered" button **alone never releases money**. Release needs courier proof, customer OTP, or customer confirmation — or the auto-confirm timeout with no complaint.
- Delivery OTPs: 6 digits, stored hashed, expire, max 5 tries, shown only to the customer.
- Courier webhooks without a signature are **hints only** — always confirm with `track()`.
- Shipping fees are calculated on the server from the vendor's saved rates.
- Track vendor shipping quality (late shipping, failed deliveries, lost parcels); admin can warn/suspend.

## 7. Frontend rules

- Use brand tokens from `04-ui-ux-design.md` only — no random hex codes in components.
- Every image uses `next/image` with width/height. Every video has a poster.
- 3D and heavy video load lazily and have a fallback (image/video) for weak devices and `prefers-reduced-motion`.
- Accessibility: WCAG 2.1 AA — alt text, keyboard navigation, focus rings, contrast.
- Forms: client-side zod validation for UX, but server is the source of truth.

## 8. Testing rules

- Unit tests for every service with business logic (orders, ledger, plans limits, release rules): **≥ 80% coverage on money modules**.
- Integration tests with a real Postgres (Testcontainers) for checkout → pay → ship → deliver → release.
- Webhook tests: bad signature, duplicate event, wrong amount.
- E2E (Playwright): customer buys, vendor ships, admin releases.
- No merge if CI is red.

## 9. Git rules

- Branches: `feat/…`, `fix/…`, `chore/…`. Conventional commits (`feat(orders): add release job`).
- Small PRs (< 400 lines changed as a guide). One PR = one task from `06-implementation-plan.md`.
- PR must include: what changed, how tested, screenshots for UI.
- Money / auth / security PRs need a second reviewer.

## 10. Rules for AI coding agents

- Read `memory.md` first, then `00-README.md`, then the task, then only the files you need.
- Do **one task at a time**. Don't refactor unrelated code.
- Don't invent API keys, endpoints, or courier/gateway fields — if unknown, leave a `// TODO [CONFIRM]` and say so.
- Don't change the DB schema, auth, payments, or ledger without stating it clearly in your summary.
- After finishing: run lint, typecheck, tests; update the task checkbox and add important decisions to `memory.md`.
