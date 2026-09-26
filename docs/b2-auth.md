# B2 · Accounts, login and access control

Status: design for backend phase B2 (2026-09-26). Source specs: `security.md` §4–5, `02-trd.md` §4–5,
`05-database-schema.md` (users, sessions, otp_codes, seller_members, audit_logs), `01-prd.md` F-CU-01, F-SO-01.
Where this file and a spec disagree, the spec wins; log the difference in `docs/memory.md`.

## 1. Who logs in where

| App (audience) | Who | Login methods | 2FA | Refresh lifetime |
|---|---|---|---|---|
| `web` (herbeauty.pk) | any active user (customers, and sellers/admins shopping) | email or phone + password; phone or email OTP (sign up or log in) | optional; required at login once enabled | 30 days |
| `seller` (seller.) | any active user; sellers see their store, others see "start your application" | email or phone + password | optional now; required before payouts / bank / courier keys (later phases); required at login once enabled | 7 days |
| `admin` (admin.) | role `support`, `finance`, `admin`, `super_admin` only | email + password, then TOTP | **always**; first login must enrol | 12 hours |

Refresh lifetime is **absolute from login**: rotating a refresh token keeps the family's original `expires_at`.

## 2. Tokens and sessions

- **Access token**: JWT signed with **EdDSA (Ed25519)** via `jose`, **15 minutes**.
  Claims: `iss: "herbeauty-api"`, `aud: "web" | "seller" | "admin"`, `sub` (user id), `sid` (session id),
  `role` (UserRole), `mfa` (true when 2FA was completed for this session), `sel` (seller id or absent),
  `srole` (seller member role or absent), `iat`, `exp`, `jti`.
  Keys: `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` (PKCS8 / SPKI PEM). When unset and `NODE_ENV !== 'production'`,
  the API generates an ephemeral key pair at boot and logs a warning. Production refuses to boot without them.
- **Every authenticated request** verifies the JWT **and** checks the session row (`revoked_at IS NULL`,
  `expires_at > now()`), so logout and "log out all devices" take effect immediately.
- **Refresh token**: 32 random bytes, base64url. Stored as `HMAC-SHA256(REFRESH_TOKEN_PEPPER, token)` hex in
  `sessions.refresh_token_hash`. **Rotated on every use**: the used row gets `revoked_at`, a new row is inserted
  with the same `family_id`, same `audience`, same `expires_at`, same `mfa_at`.
- **Reuse detection**: presenting a refresh token whose row is already revoked ⇒ revoke **all** sessions of that
  user (security.md §4), write audit log `auth.refresh_reuse`, respond `401 SESSION_REVOKED`.
- Session row stores `audience`, `user_agent`, `ip` (client IP), `mfa_at`, `last_used_at`.
- Seller context (`sel`, `srole`) is resolved **at token issue time** from `seller_members` (first membership by
  `created_at`; multi-store switching is out of scope). It is **never** read from request body, query or URL.

## 3. Endpoints (all under `/v1`, request/response schemas in `packages/types/src/auth.ts`)

Public (`@Public()`), tighter rate limits (per IP, `@nestjs/throttler`): register 5/min, login 10/min,
otp/send 5/min, otp/verify 10/min, password/* 5/min, 2fa/challenge 10/min, refresh 30/min.

| Method + path | Auth | What |
|---|---|---|
| `POST /auth/register` | public | Create account. Always answers `202 {status:"verification_sent", channel, target}` whether or not the email/phone already exists (no account enumeration). New account: user row (unverified) + verify OTP sent. Existing account: a notice message ("someone tried to sign up with this address — log in or reset your password") is sent instead. `audience:"seller"` also creates a `sellers` row (status `draft`, chosen `type`, `storeName`) + `seller_members` owner row and sets `users.role = 'seller'`. |
| `POST /auth/otp/send` | public | Send a 6-digit code for `purpose: "login" \| "verify"` to an email or phone. Always `202 {status:"sent", expiresInSec:300}`. `login` codes only go to existing accounts **or** (phone/email not yet registered) create nothing until verify. Limits: max **3 sends per 15 min per target** and **per client IP** ⇒ `429 RATE_LIMITED` with `details.retryAfterSec`. |
| `POST /auth/otp/verify` | public | Check a code. `purpose:"verify"`: marks email/phone verified and returns a login result (this is how registration completes). `purpose:"login"`: logs in (web audience only). If no account exists for that phone/email yet and `fullName` is absent ⇒ `422 PROFILE_REQUIRED` **without** consuming the code; resubmit with `fullName` to create a customer and log in. |
| `POST /auth/login` | public | Password login. Result is a `LoginResult` (below). |
| `POST /auth/2fa/challenge` | public (challenge token) | Finish login with a TOTP code or a backup code. |
| `POST /auth/2fa/setup` | bearer **or** setup challenge token | Create (or replace a not-yet-enabled) TOTP secret; returns `{secret, otpauthUri}`. Never replaces an enabled secret. |
| `POST /auth/2fa/enable` | bearer **or** setup challenge token | Confirm the first TOTP code ⇒ enable 2FA, return 10 backup codes **once**. With a setup challenge token it also returns a `LoginResult` (session). |
| `POST /auth/2fa/disable` | bearer | Needs current password + TOTP/backup code. Forbidden (`403`) for admin roles. |
| `POST /auth/refresh` | public (refresh token in body) | Rotate. Returns `TokenPair`. |
| `POST /auth/logout` | public (refresh token in body) | Revoke that session. Always `204`. |
| `POST /auth/logout-all` | bearer | Revoke every session of the user. `204`. |
| `GET /auth/sessions` | bearer | List the user's active sessions (current one flagged). |
| `DELETE /auth/sessions/:id` | bearer | Revoke one of **the caller's own** sessions (`WHERE id = :id AND user_id = :sub`; other users' ids ⇒ 404). |
| `POST /auth/password/forgot` | public | Sends a `reset` OTP if the account exists. Always `202`. Same send limits as OTP. |
| `POST /auth/password/reset` | public | `identifier + code + newPassword` ⇒ new hash, clears lock, **revokes all sessions**, audit `auth.password_reset`. |
| `GET /me` | bearer | `Me` profile (user, seller membership summary, 2FA state, verification state). |
| `PATCH /me` | bearer | Update `fullName` only (strict schema; anything else ⇒ 400). |
| `GET /seller/me` | bearer, aud `seller`, has seller context | The caller's seller: status, type, store name, onboarding step. |
| `POST /seller/application` | bearer, aud `seller`, **no** seller context yet | Start an application: `{type, storeName}` ⇒ seller draft + owner membership + role `seller`; returns new `TokenPair` (so `sel` appears). `409` if the user already has a seller. |
| `GET /seller/products` | bearer, aud `seller`, seller context | The caller's own products (all statuses), via `withSellerScope` (RLS second lock). |
| `GET /admin/overview` | bearer, aud `admin`, role admin-ish, `mfa: true` | Counts: sellers by status, live products, users, orders. Writes nothing. |

### LoginResult (discriminated on `status`)
- `{status:"ok", tokens: TokenPair, user: Me}`
- `{status:"mfa_required", challengeToken, expiresInSec}` — user has 2FA; call `/auth/2fa/challenge`.
- `{status:"mfa_setup_required", challengeToken, expiresInSec}` — admin without 2FA; call `/auth/2fa/setup` then `/auth/2fa/enable` with the challenge token.

`TokenPair = {accessToken, accessExpiresAt, refreshToken, refreshExpiresAt}` (ISO datetimes).

**Challenge token**: JWT (same key), `typ: "mfa"` or `"mfa_setup"`, `aud`, `sub`, `jti`, **5 minutes**.
It is **not** an access token: the auth guard rejects any token whose `typ` is set. It proves the password step
only; every TOTP attempt against it counts as a failed login on failure.

## 4. Passwords, OTP, 2FA, lockout

- **Argon2id** via `@node-rs/argon2` (memoryCost 19456 KiB, timeCost 2, parallelism 1 — OWASP 2024 minimum).
  Unknown account on login ⇒ verify against a fixed dummy hash so timing does not reveal existence.
- Password policy: 8–128 chars; reject if in the local common-password list (`apps/api/src/auth/common-passwords.ts`,
  top ~1,000) and, when `HIBP_ENABLED=true`, the HIBP k-anonymity range API (5-char SHA-1 prefix, 2 s timeout,
  **fail open** with a warning log). Error code `WEAK_PASSWORD`.
- Identifiers: emails trimmed + lower-cased; phones normalised to E.164 (`03001234567` / `3001234567` /
  `+923001234567` ⇒ `+923001234567`; Pakistan default country). Anything else ⇒ `VALIDATION_FAILED`.
- **OTP**: 6 digits from `crypto.randomInt`, stored as `HMAC-SHA256(OTP_PEPPER, purpose|target|code)`,
  **5 min** expiry, **3 tries** then the code is dead, single use, newest code wins (older unused codes for the same
  target+purpose are invalidated on send). `otp_codes.request_ip` records the requester IP for the per-IP limit.
- **Delivery**: `MessageProvider` interface (`sendSms(to, text)`, `sendEmail(to, subject, text)`).
  Implementations: `LogMessageProvider` (dev: logs the code through Nest `Logger`, refuses to run when
  `NODE_ENV === 'production'`) and `MemoryMessageProvider` (tests: keeps an outbox the tests read).
  Real SMS/email providers are a later phase `[CONFIRM provider]`.
- **TOTP**: RFC 6238 via `otpauth` (SHA-1, 6 digits, 30 s, ±1 step window). Issuer "Her Beauty".
  Secret stored in `users.twofa_secret_enc` with **AES-256-GCM** (`ENCRYPTION_KEY`, 32 bytes base64;
  layout `[1B key version][12B IV][16B tag][ciphertext]`). **Replay protection**: `users.twofa_last_step` stores the
  last accepted time-step; a code for a step ≤ that is rejected.
- **Backup codes**: 10 × 10 chars (Crockford base32, shown as `XXXXX-XXXXX`), stored as
  `HMAC-SHA256(OTP_PEPPER, code)` in `twofa_backup_codes`, single use. Regenerating replaces all.
- **Lockout**: each failed password or 2FA attempt increments `users.failed_logins`. From the 5th consecutive
  failure the account is locked for `min(2^(n-5), 60)` minutes (`locked_until`), and a lock notice is sent once
  per lock. While locked, login answers the **same** `401 INVALID_CREDENTIALS` without checking the password.
  Success resets the counter.
- **CAPTCHA**: `CaptchaService` verifies Cloudflare Turnstile when `TURNSTILE_SECRET_KEY` is set. It becomes
  required for an IP after 5 failed logins in 15 minutes (in-memory window; Redis later). Missing/invalid ⇒
  `401 INVALID_CREDENTIALS` with `details.captchaRequired: true` — the flag is set by IP, never by account, so it
  does not reveal whether an account exists. Without a secret key the check is skipped (dev/test).
- Error codes: `INVALID_CREDENTIALS` (401, same message for unknown account / wrong password / locked / wrong
  audience), `INVALID_CODE` (400, wrong/expired/used OTP or TOTP), `WEAK_PASSWORD` (400), `PROFILE_REQUIRED` (422),
  `RATE_LIMITED` (429), `UNAUTHENTICATED` (401, missing/invalid/expired access token), `SESSION_REVOKED` (401),
  `FORBIDDEN` (403), `MFA_REQUIRED` (403, admin endpoint with an `mfa:false` token), `CONFLICT` (409).

## 5. Authorization in the API

- A global `AuthGuard` (APP_GUARD) is **default-deny**: a route must be marked `@Public()` or have a valid access
  token. Existing catalogue, ads, health endpoints get `@Public()`.
- `@Audiences('seller')`, `@Roles('admin', 'super_admin', ...)`, `@RequireMfa()`, `@SellerRoles('owner', ...)`
  decorators, checked by the same guard. `@CurrentAuth()` param decorator gives
  `{userId, sessionId, role, audience, mfa, sellerId?, sellerRole?}`.
- `PrismaService.withSellerScope(sellerId, fn)` runs `fn(tx)` inside an interactive transaction after
  `SELECT set_config('app.seller_id', $1, true), set_config('app.role', 'seller', true)`. Every seller query
  still has `WHERE seller_id = :tokenSellerId` (RLS is the second lock, security.md §5).
- Client IP comes from Express `req.ip` with `app.set('trust proxy', TRUST_PROXY)` (`TRUST_PROXY` env, default
  `loopback` so a Next.js server on the same host can forward the browser IP in `X-Forwarded-For`).
- **Audit log** (`audit_logs`): `auth.login` (admin audience, success), `auth.login_failed` (admin audience),
  `auth.locked`, `auth.refresh_reuse`, `auth.logout_all`, `auth.password_reset`, `auth.2fa_enabled`,
  `auth.2fa_disabled`, `seller.application_started`. Never log passwords, codes, tokens or secrets.

## 6. Database changes (migration `20260926120000_b2_auth`)

- `sessions`: add `audience text NOT NULL DEFAULT 'web' CHECK (audience IN ('web','seller','admin'))`,
  `mfa_at timestamptz`, `last_used_at timestamptz`.
- `users`: add `twofa_last_step bigint`.
- `otp_codes`: add `request_ip inet`; index `(request_ip, created_at DESC)`.
- New `twofa_backup_codes (id uuid PK, user_id uuid FK users ON DELETE CASCADE, code_hash text UNIQUE,
  used_at timestamptz, created_at timestamptz default now())`, index `(user_id)`.

## 7. Next.js apps (BFF — tokens never reach browser JavaScript)

Shared package **`@hb/auth`** (`packages/auth`, server-only, depends on `next` as a peer):
- `createAuthConfig({ audience, cookieSameSite })` per app.
- Cookies: access `hb_at` (maxAge = access expiry) and refresh `hb_rt` (maxAge = refresh expiry), both
  `httpOnly`, `path=/`, `SameSite=Lax` (`Strict` for admin), `Secure` + `__Host-` name prefix when
  `NODE_ENV === 'production'`.
- `authApi` — typed server-side client for `/v1/auth/*`, `/v1/me` (uses `NEXT_PUBLIC_API_BASE_URL` or
  `API_INTERNAL_URL`), forwarding the browser IP as `X-Forwarded-For` and the user agent.
- `getSession()` for server components: reads cookies, returns `Me | null` (calls `GET /me`; on 401 tries one
  refresh and retries).
- Server actions (forms, progressive enhancement, `useActionState`): login, register, verify, otp send, 2FA
  challenge / setup / enable, forgot / reset password, logout, logout-all. Next.js server actions already reject
  cross-origin posts (Origin vs Host), which is our CSRF protection for cookie-auth state changes.
- `middleware.ts` per app: protected paths without a valid-looking access cookie ⇒ try refresh (if `hb_rt`) and
  set new cookies, else redirect to `/login?next=<path>` (only same-origin relative `next` values are honoured).
  The middleware does **not** trust the JWT — the API verifies every call.

Pages (brand UI from `@hb/ui`; visible labels, blur-first validation, errors that never blame the user,
verb-first buttons, keyboard accessible, 360 px mobile):
- **web**: `/login` (Password | Phone code tabs), `/register`, `/verify`, `/forgot-password`, `/reset-password`,
  `/login/2fa`, `/account` (profile name, email/phone + verified state, sign-in methods, 2FA on/off with QR +
  backup codes, active sessions with "Sign out" per device and "Sign out everywhere", "Log out").
  Header account icon: logged out ⇒ `/login`; logged in ⇒ `/account`.
- **seller**: `/login` (+ `/login/2fa`), `/register` (choose **Vendor** or **Manufacturer**, store name, name,
  email, mobile, password ⇒ `/verify`), `/forgot-password`, `/reset-password`, `/dashboard` (application
  status card for draft/submitted sellers, "Start your application" for users without a seller, store name,
  log out), `/security` (2FA, sessions). `/` ⇒ `/dashboard` or `/login`.
- **admin**: `/login` ⇒ `/login/2fa` (code) or `/login/2fa/setup` (QR code SVG via `qrcode`, manual key, first
  code, then backup codes shown once with "I saved these codes") ⇒ `/` overview (counts from
  `/admin/overview`), log out. Every admin page requires a session.

## 8. Seed (dev only)

- `SEED_DEMO_PASSWORD` (optional): when set, seeded store owners (`owner@<slug>.test`), the two customers
  (`ayesha@hb.test`, `sana@hb.test`) and the super admin get this password; unset ⇒ accounts have no password
  (OTP only). Never a default value in code.
- Super admin (`SEED_ADMIN_EMAIL`) is created without 2FA, so the first admin login walks through enrolment.

## 9. Environment variables (add to `.env.example` with fake values)

`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `REFRESH_TOKEN_PEPPER`, `OTP_PEPPER`, `ENCRYPTION_KEY`, `TRUST_PROXY`,
`TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `HIBP_ENABLED`, `API_INTERNAL_URL`,
`SEED_DEMO_PASSWORD`, `SEED_ADMIN_EMAIL`. Peppers and the encryption key: required in production; in dev/test a fixed,
clearly-fake value from `.env.example` or the test setup.

## 10. Out of scope for B2

Google login (F-CU-01), guest checkout OTP (F-CU-02), staff invitations (F-SO-07), the 9-step seller wizard
(P7), KYC uploads, Redis-backed rate limits, real SMS/email providers.
