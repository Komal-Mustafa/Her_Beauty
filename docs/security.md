# Security — Her Beauty (HB) Marketplace

> v0.1 · 2026-09-24 · Read with `02-trd.md`, `05-database-schema.md`, `07-payment-gateway.md` and `rules.md`
> This file explains **what we protect, from whom, and how**. `rules.md` has the short "must do" list; this file has the full plan.
> Items marked **[CONFIRM]** need a decision from the client or a legal check.

---

## 1. What we protect (assets)

| Asset | Why it matters | Level |
|---|---|---|
| **Money** (escrow balance, vendor wallets, payouts) | Direct theft = real loss + lost trust | 🔴 Critical |
| **Admin accounts** | Admin can release money, approve vendors | 🔴 Critical |
| **Vendor courier API keys** | Attacker could book/cancel parcels on vendor's account | 🔴 Critical |
| **Vendor bank details (IBAN)** | Change it = payouts go to attacker | 🔴 Critical |
| **KYC documents** (ID card, business papers) | Identity theft, legal trouble | 🔴 Critical |
| **Customer data** (name, phone, address, orders) | Privacy, scams using order details | 🟠 High |
| **Vendor accounts** | Fake products, fake deliveries, stolen payouts | 🟠 High |
| **Product catalog & reviews** | Fake reviews, harmful links in descriptions | 🟡 Medium |
| **Ads & analytics** | Click fraud, bad ad content | 🟡 Medium |
| **Brand / uptime** | Downtime and defacement hurt trust | 🟡 Medium |

## 2. Who might attack (threat actors)

| Attacker | What they want | Example |
|---|---|---|
| **Dishonest vendor** | Get paid without delivering; see other vendors' data | Marks "delivered" falsely; changes `vendor_id` in a request |
| **Dishonest customer** | Free products, refunds | Says "not received" after delivery; COD refusal abuse |
| **Outside hacker** | Money, data, admin access | Credential stuffing, SQL injection, stolen tokens |
| **Scammer** | Trick customers | Fake "Her Beauty support" calls using leaked order info |
| **Bots** | Spam, scraping, fake clicks | Fake sign-ups, ad click fraud, OTP spam (SMS cost) |
| **Insider** | Misuse admin/staff power | Staff views KYC or releases money without reason |
| **Supply chain** | Malicious code | Bad npm package |

## 3. Threat model (STRIDE — simple version)

| Threat | Where | What we do |
|---|---|---|
| **S**poofing (pretending to be someone) | Login, webhooks | Strong auth, 2FA, signed webhooks, verify with gateway/courier API |
| **T**ampering (changing data) | Prices, amounts, order status | Server calculates all prices; state machine; append-only ledger |
| **R**epudiation ("I didn't do it") | Refunds, payouts, delivery | Audit log; delivery proof (courier / OTP / customer) |
| **I**nformation disclosure (leaks) | Other vendors' orders, KYC | Vendor scoping, RLS, encryption, masked logs |
| **D**enial of service | Checkout, OTP, search | Cloudflare, rate limits, queues, SMS limits |
| **E**levation of privilege | Vendor → admin | RBAC default-deny, separate admin app, 2FA |

## 4. Authentication (who you are)

**Passwords**
- Hash with **Argon2id** (never MD5/SHA1/bcrypt-without-reason).
- Minimum 8 characters; block known leaked passwords (HIBP k-anonymity check).
- No password hints, no "security questions".

**Sessions / tokens**
- Access token: JWT, **15 min**, signed with asymmetric key (EdDSA/RS256), key rotated.
- Refresh token: random, **stored hashed** in DB, **rotated on every use**, 30 days customer / 7 days vendor / 12 hours admin.
- **Refresh reuse detection**: if an old refresh token is used again → kill all sessions of that user (it was stolen).
- Cookies: `httpOnly; Secure; SameSite=Lax` (admin: `SameSite=Strict`).
- "Log out all devices" button for every user.

**OTP (email / SMS)**
- 6 digits, expire in **5 min**, max **3 tries**, stored hashed.
- Max 3 OTP sends per 15 min per phone and per IP (stops **SMS bombing** and SMS bill abuse).

**2FA (TOTP app, e.g. Google Authenticator)**
- **Admin: always required.**
- **Vendor: required before first payout and before changing bank details or courier keys.**
- Customer: optional.
- Backup codes (10, one-time, hashed).

**Brute force**
- 5 wrong logins → slow down (increasing delay) + CAPTCHA (Cloudflare Turnstile). Tell user by email about lockouts.
- Same error message for "wrong email" and "wrong password" (don't reveal which accounts exist).

## 5. Authorization (what you can do)

**Roles:** `customer`, `vendor_owner`, `vendor_staff` **[CONFIRM if needed]**, `support`, `admin`, `super_admin`.

- **Default = deny.** Every route has a `@Roles()` guard.
- **Vendor scoping:** `vendor_id` always comes from the token, **never** from request body/query/URL.
- **IDOR check on every "by id" query:** `WHERE id = :id AND vendor_id = :tokenVendorId` (or `customer_id` for customers).
- **Postgres Row-Level Security** on vendor tables as a second lock, so even a coding mistake can't leak another vendor's rows.
- **Sensitive admin actions need a reason text + are logged:** force release, refund, payout approve, vendor suspend, KYC view, bank change approve.
- **Four-eyes rule for big money** **[CONFIRM amount]**: payouts or refunds above e.g. PKR 200,000 need a second admin to approve.
- Admin panel on a **separate subdomain** (`admin.`), optionally IP allow-list / VPN.

## 6. Payment security

| Risk | Protection |
|---|---|
| Card data stolen from our servers | **We never touch card data** — gateway hosted checkout only (PCI-DSS SAQ A scope) |
| Customer changes the price in the browser | Amount always calculated on server from DB |
| Fake "payment success" redirect | Order marked paid **only** by verified webhook **+** gateway status API check |
| Fake / replayed webhook | Verify signature, check timestamp, unique `event_id` table (dedupe) |
| Amount mismatch | Webhook amount + currency + order id must match our order exactly, else alert |
| Double charge / double refund | Idempotency keys on create payment, refund, payout |
| Wrong balance | Double-entry **append-only ledger**; balances computed from entries |
| Silent money bugs | **Daily reconciliation**: gateway settlement report vs ledger; any mismatch → alert + freeze payouts |
| Payout to attacker's account | Bank change needs 2FA + email confirmation + **72-hour payout hold** after change + admin review |
| Release job runs twice | Job is idempotent (checks status inside a locked transaction) |

## 7. Shipping security (vendor-provided shipping)

| Risk | Protection |
|---|---|
| Vendor marks "delivered" without shipping | Vendor click alone **never** releases money. Needs courier API proof, customer OTP, or customer confirmation; otherwise auto-confirm after 14 days with no complaint |
| Vendor courier API keys stolen | Encrypted (AES-256-GCM, key in KMS), decrypted only in shipping module, never sent to frontend (show `••••1234`), never logged |
| Fake courier webhook | Signature check if courier supports it; otherwise webhook = hint only, confirm by calling `track()` |
| Delivery OTP guessed | 6 digits, hashed, expires, max 5 tries, shown only to the customer |
| Customer falsely claims "not received" | Courier proof / OTP record; dispute process with evidence from both sides |
| Customer address exposed | Vendor sees full address only for its own active orders; masked after delivery + 30 days **[CONFIRM]** |

## 7b. Seller registration & brand security

| Risk | Protection |
|---|---|
| Fake / bot seller sign-ups | Turnstile, email + phone OTP, rate limit registrations per IP/device |
| Fake business / stolen identity | ID + selfie check, NTN / SECP checks **[CONFIRM method]**, admin review before selling |
| One person, many banned accounts | Duplicate check on NTN, phone, IBAN, ID number (hashed), device fingerprint |
| Counterfeit products | Brand protection: protected brands need an approved authorization; "Report fake" button; strike system |
| Fake authorization letters | Manufacturer approves requests for its own brand; admin spot-checks; forged docs → permanent ban |
| Forged / expired licences & certificates | Expiry dates stored; reminder 30 days before; badge removed when expired |
| Registration documents leaked | Private bucket, encrypted keys, 60-second signed links, every view logged |
| Account type abuse (vendor pretends to be manufacturer for "Official Brand" badge) | Badge only after trademark / licence verification by admin |

**Advertising security**
- Ad seat and slot booking inside a locked DB transaction (no two sellers get the same seat/day).
- Package prices, pro-rating and discounts calculated **on the server**.
- Creatives: file checks as §10 + admin approval; no external links or scripts in ad content.
- Impressions/clicks: bot filtering, dedupe per session, signed tracking tokens so competitors can't burn each other's quota.

## 8. Data protection

**Encryption**
- In transit: **TLS 1.2+ everywhere**, HSTS preload.
- At rest: managed DB encryption + **app-level encryption** for: IBAN, courier API keys, 2FA secrets, KYC file keys.
- Keys in a KMS / secret manager, rotated yearly. Envelope encryption (data key per record type).

**Data minimization**
- Collect only what we need. No storing full CNIC numbers unless legally required — store doc image in private bucket + last 4 digits **[CONFIRM KYC rule]**.
- Order snapshots keep address for the order; old addresses masked after retention period.

**Retention** **[CONFIRM with legal]**
| Data | Keep for |
|---|---|
| Orders, ledger, payouts | 7+ years (tax/accounting) |
| KYC documents | While vendor active + legally required period |
| Logs | 90 days hot, 1 year archive |
| Audit logs | 3+ years |
| Deleted customer accounts | Personal data removed in 30 days; order records anonymized |

**Privacy rights**
- Customer can download their data and delete their account.
- Follow Pakistan's data-protection rules as they apply **[CONFIRM current law with legal counsel]**; if selling abroad, GDPR-style rights.

## 9. Application security (OWASP Top 10)

| OWASP risk | What we do |
|---|---|
| A01 Broken access control | RBAC, vendor scoping, RLS, IDOR tests |
| A02 Crypto failures | Argon2id, AES-256-GCM, TLS, KMS |
| A03 Injection | Prisma / parameterized queries only; no raw string SQL; zod validation |
| A04 Insecure design | This threat model; state machine; escrow proof rules |
| A05 Misconfiguration | IaC, no default passwords, debug off in prod, least-privilege cloud IAM |
| A06 Vulnerable components | Dependabot, `pnpm audit`, pinned versions, lockfile review |
| A07 Auth failures | 2FA, rate limits, token rotation, reuse detection |
| A08 Integrity failures | Signed webhooks, CI with protected branches, signed commits for release |
| A09 Logging failures | Structured logs, audit log, alerts (see §12) |
| A10 SSRF | No fetching user-given URLs; allow-list for courier/gateway hosts |

**XSS**
- React escapes by default. Vendor product descriptions = rich text **sanitized with DOMPurify** on save and on render. No `<script>`, `<iframe>`, `on*` attributes, `javascript:` links.

**CSRF**
- SameSite cookies + CSRF token for cookie-auth state changes.

**Security headers**
```
Content-Security-Policy: default-src 'self'; img-src 'self' data: https://<r2-domain>;
  media-src https://<stream-domain>; script-src 'self' 'nonce-...'; frame-ancestors 'none';
  connect-src 'self' https://api.<domain>
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```
(Gateway hosted-checkout domains added to `form-action` / redirects as needed.)

## 10. File upload security (images, videos, 3D models, KYC)

- Upload with **short-lived signed URLs** direct to storage (5 min).
- Check real file type by **magic bytes**, not extension. Allowed: jpg/png/webp, mp4, glb, pdf (KYC).
- Size limits: image 5 MB, video 200 MB, 3D 8 MB, KYC 10 MB **[CONFIRM]**.
- **Strip EXIF** (removes GPS location) from images.
- **Virus scan** (ClamAV worker) before a file becomes public.
- 3D `.glb`: parse and re-export in worker; reject files with external URLs or huge vertex counts.
- **KYC bucket is private**; admin views through 60-second signed links; every view logged.
- Files never served from the main app domain (separate media domain) to avoid cookie/XSS issues.

## 11. Infrastructure security

- **Cloudflare** in front: WAF (OWASP rules), DDoS protection, bot management, Turnstile.
- **Rate limits** at edge + in API (Redis):
  | Route | Limit |
  |---|---|
  | Login / OTP | 5/min per IP+account |
  | Checkout / payment create | 10/min per user |
  | General API | 100/min per user |
  | Search | 60/min per IP |
  | Webhooks | by source IP allow-list where courier/gateway publishes IPs |
- **Database**: private network only, no public IP, TLS, separate DB users (app user can't `DELETE`/`UPDATE` ledger table).
- **Secrets**: secret manager (Doppler / AWS Secrets Manager / Vercel env). Never in git. Rotate on staff leaving.
- **Least privilege IAM**: each service has only the permissions it needs.
- **Backups**: daily snapshots + point-in-time recovery, encrypted, stored in a separate account; **restore test monthly**.
- **Environments separated**: staging uses sandbox gateway/courier keys and fake data — never copy production customer data to staging.

## 12. Logging, monitoring & alerts

**Log** (structured JSON): request id, user id, role, route, status, latency.
**Never log**: passwords, tokens, OTPs, card data, full phone, IBAN, API keys (masking middleware).

**Audit log** (append-only) for: admin logins, role changes, vendor approve/suspend, KYC view, bank/courier-key changes, refunds, releases, payouts, plan/commission changes.

**Alerts** (to Slack/WhatsApp/email of on-call):
- Reconciliation mismatch (any amount).
- Webhook signature failures spike.
- Many failed logins / OTP sends from one IP or to one account.
- Payout to a bank account changed in last 72 h.
- Admin action outside working hours **[CONFIRM]**.
- Error rate > 2% or checkout failures spike.
- Vendor with sudden order spike + new account (fraud).

## 13. Fraud prevention

| Fraud | Signal | Action |
|---|---|---|
| Fake vendor | New account, high volume, low prices on famous brands | Longer hold (14 days) for first 20 orders; manual review |
| Counterfeit products | Customer complaints, brand reports | Report button, takedown process, vendor strike system |
| Fake reviews | Reviews not from buyers | **Verified purchase only**; one review per order item |
| COD abuse | Customer refuses many COD parcels | COD blocked after 2 refusals; phone verification required for COD |
| Refund abuse | Many "not received" claims | Check proof; limit per customer; manual review |
| Ad click fraud | Many clicks from same IP/bot | Bot filtering, dedupe clicks per session, vendor charged per validated click/impression only |
| Account takeover | New device + password change + bank change | Step-up 2FA + email alerts + payout hold |

## 14. Secure development (SDLC)

- Branch protection: PR + review + green CI required on `main`.
- **Security-sensitive PRs** (auth, payments, ledger, shipping credentials, uploads) need a second reviewer.
- CI checks: lint, typecheck, tests, `pnpm audit`, secret scanning (gitleaks), SAST (Semgrep / CodeQL).
- Security tests in the test suite:
  - IDOR: vendor A tries to read/edit vendor B's product/order → must fail.
  - Webhook: bad signature, replay, wrong amount → must fail.
  - Delivery: vendor marks delivered without proof → no release.
  - Price tampering: client sends a lower price → server ignores it.
- **AI coding agents** follow the same rules: they must not add dependencies, change auth/payment/ledger code, or touch secrets without the change being clearly listed in the PR summary.

## 15. Incident response (when something goes wrong)

**Severity**
- **SEV1**: money stolen/at risk, data breach, site down → act immediately.
- **SEV2**: one feature broken with security impact → same day.
- **SEV3**: minor issue → next sprint.

**Steps (simple playbook)**
1. **Detect** — alert or report.
2. **Contain** — use kill switches:
   - `PAYOUTS_FROZEN=true` (stop all payouts)
   - `RELEASES_FROZEN=true` (stop escrow releases)
   - disable one vendor / one courier account / one gateway
   - force logout all admin sessions, rotate keys
3. **Investigate** — audit log, request logs, ledger.
4. **Fix** — patch, rotate secrets, restore data if needed.
5. **Notify** — affected users, client, payment gateway, and authorities if required by law **[CONFIRM]**.
6. **Learn** — short write-up; add a test and update this file.

**Contacts list** (fill in): client owner, lead dev, hosting, payment gateway support, courier support, legal.

## 16. Pre-launch security checklist

- [ ] All items in `rules.md §5, §6, §6b` done
- [ ] 2FA enforced for all admins
- [ ] Pen-test or at least OWASP ZAP scan + manual IDOR tests on vendor/customer APIs
- [ ] Webhook signature + replay tests passing
- [ ] Reconciliation job running and alerting
- [ ] Kill switches tested on staging
- [ ] Backups restored successfully once
- [ ] Secrets rotated from dev values; no secrets in git history
- [ ] CSP and security headers verified (securityheaders.com grade A)
- [ ] Privacy policy, terms, refund policy, vendor agreement published
- [ ] Gateway confirmed marketplace/escrow model is allowed
- [ ] Incident contact list filled in

## 17. Review schedule

- This file: review every 3 months or after any incident.
- Access review (who is admin): monthly.
- Dependency updates: weekly (automated PRs).
- External pen-test: before launch and yearly **[CONFIRM budget]**.
