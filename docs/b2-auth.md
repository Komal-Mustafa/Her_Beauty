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
  `sessions.refresh_token_hash`. **Rotated on every use**: the used row gets `revoked_at` and
  `revoked_reason = 'rotated'`, a new row is inserted with the same `family_id`, same `audience`, same
  `expires_at`, same `mfa_at`.
- Every revoke records **why** in `sessions.revoked_reason`: `rotated`, `logout`, `logout_all`,
  `device_revoked` (`DELETE /auth/sessions/:id`), `password_reset`, `reuse`, `access_lost` (refresh for a user who
  is no longer active or no longer allowed in that app), `account_claimed` (see §3, first verification).
- **Reuse detection** (security.md §4), checked in this order on `POST /auth/refresh`:
  1. unknown token, or the family's `expires_at` has passed ⇒ `401 UNAUTHENTICATED` (an expired family never
     triggers reuse handling);
  2. row revoked for any reason other than `rotated` (revoked on purpose) ⇒ `401 SESSION_REVOKED`, nothing
     else is touched — signing out one device, logging out or resetting the password never signs the user out
     of sessions created later;
  3. row rotated away **less than 10 s ago** (`REUSE_GRACE_MS`) ⇒ a concurrent refresh (two tabs, a retried
     request): `401 UNAUTHENTICATED`, nothing revoked. Two parallel refreshes with one token: one rotates, the
     other gets this answer;
  4. row rotated away longer ago ⇒ the token was stolen: revoke **all** sessions of that user (reason `reuse`),
     write audit log `auth.refresh_reuse`, respond `401 SESSION_REVOKED`.
- Session row stores `audience`, `user_agent`, `ip` (client IP), `mfa_at`, `last_used_at`.
- Seller context (`sel`, `srole`) is resolved **at token issue time** from `seller_members` (first membership by
  `created_at`; multi-store switching is out of scope). It is **never** read from request body, query or URL.

## 3. Endpoints (all under `/v1`, request/response schemas in `packages/types/src/auth.ts`)

Public (`@Public()`), tighter rate limits (per IP, `@nestjs/throttler`): register 5/min, login 10/min,
otp/send 5/min, otp/verify 10/min, password/* 5/min, 2fa/challenge 10/min, refresh 30/min.

| Method + path | Auth | What |
|---|---|---|
| `POST /auth/register` | public | Create account. Always answers `202 {status:"verification_sent", channel, target}` whether or not the email/phone already exists (no account enumeration). Only the **primary** identifier (the email, else the phone) is bound to the account and messaged; a phone given next to an email is kept in `users.pending_phone` (shown in `Me.phone` with `phoneVerified:false`, never an identifier, never messaged, never checked for uniqueness). New account: user row (unverified) + the sign-up's verify OTP. Existing account (including soft-deleted): a notice message ("someone tried to sign up with this address — log in or reset your password") is sent instead, and if that account was never verified the sign-up is **disputed** (its password is dropped, see *Account claims*). Exactly one send is recorded per request either way. `audience:"seller"` also creates a `sellers` row (status `draft`, chosen `type`, `storeName`) + `seller_members` owner row and sets `users.role = 'seller'`. |
| `POST /auth/otp/send` | public | Send a 6-digit code for `purpose: "login" \| "verify"` to an email or phone. Always `202 {status:"sent", expiresInSec:300}`. `login` codes only go to an active account's verified or unclaimed identifier **or** (phone/email not yet registered) create nothing until verify. `verify` codes only go to the identifier of an active account that is still **unclaimed**. Limits: max **3 sends per 15 min per target** and **per client IP** ⇒ `429 RATE_LIMITED` with `details.retryAfterSec`. |
| `POST /auth/otp/verify` | public | Check a code. `purpose:"verify"`: claims an unclaimed account — marks the address verified and returns a login result (this is how registration completes); any other account ⇒ `400 INVALID_CODE`. `purpose:"login"`: logs in (web audience only); on an unclaimed account it is a claim. If no account exists for that phone/email yet and `fullName` is absent ⇒ `422 PROFILE_REQUIRED` **without** consuming the code; resubmit with `fullName` to create a customer and log in. |
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
| `POST /auth/password/forgot` | public | Sends a `reset` OTP if an active account holds the identifier verified or unclaimed. Always `202`. Same send limits as OTP. |
| `POST /auth/password/reset` | public | `identifier + code + newPassword` ⇒ new hash, clears lock, **revokes all sessions**, audit `auth.password_reset`. On an unclaimed account it is a claim first. |
| `GET /me` | bearer | `Me` profile (user, seller membership summary, 2FA state, verification state). |
| `PATCH /me` | bearer | Update `fullName` only (strict schema; anything else ⇒ 400). |
| `GET /seller/me` | bearer, aud `seller`, has seller context | The caller's seller: status, type, store name, onboarding step. |
| `POST /seller/application` | bearer, aud `seller`, **no** seller context yet | Start an application: `{type, storeName}` ⇒ seller draft + owner membership + role `seller`; returns new `TokenPair` (so `sel` appears). `409` if the user already has a seller. |
| `GET /seller/products` | bearer, aud `seller`, seller context | The caller's own products (all statuses), via `withSellerScope` (RLS second lock). |
| `GET /admin/overview` | bearer, aud `admin`, role admin-ish, `mfa: true` | Counts: sellers by status, live products, users, orders. Writes nothing. |

### Account claims (who owns an account)

An identifier stands on its account as **verified** (its owner proved it), **unclaimed** (nobody has proven any
identifier of the account yet: the sign-up is not finished) or **stray** (unverified on an account whose owner
proved another one — only in rows from before `pending_phone`). A stray identifier is never a credential: no
login, verify or reset code goes to it, and a code login for it ⇒ `401 INVALID_CREDENTIALS`.

The first proof of an unclaimed account's identifier (verify code, code login, or password reset) **claims** it.
Who proved it decides what survives from the sign-up:
- the code the sign-up request itself sent (hashed under its own `sign_up` label), and nobody registered the
  same address since: everything is kept (the normal sign-up);
- a `verify` code sent again with `otp/send` on an undisputed sign-up: the password, 2FA and sessions are
  dropped, the pending phone is kept (unverified) — a resent code may reach someone who never signed up;
- anything else (a disputed sign-up, a code login, a password reset): password, 2FA, sessions **and** the
  pending phone are dropped.

The claimant signs in without a password and sets one with "forgot password". Sessions are revoked with
reason `account_claimed`. So whoever signs up with somebody else's address or number keeps no way in once the
real owner proves it (registration pre-hijacking), and a number typed at sign-up can neither be verified into
the account nor used to sign in to it. Verifying a second identifier of an established account needs a
signed-in flow (later phase).

### LoginResult (discriminated on `status`)
- `{status:"ok", tokens: TokenPair, user: Me}`
- `{status:"mfa_required", challengeToken, expiresInSec}` — user has 2FA; call `/auth/2fa/challenge`.
- `{status:"mfa_setup_required", challengeToken, expiresInSec}` — admin without 2FA; call `/auth/2fa/setup` then `/auth/2fa/enable` with the challenge token.

`TokenPair = {accessToken, accessExpiresAt, refreshToken, refreshExpiresAt}` (ISO datetimes).

**Challenge token**: JWT (same key), `typ: "mfa"` or `"mfa_setup"`, `aud`, `sub`, `jti`, **5 minutes**.
It is **not** an access token: the auth guard rejects any token whose `typ` is set. It proves the password step
only; every TOTP attempt against it counts as a failed login on failure. It is **single use**: when it completes
a sign-in (`/2fa/challenge`, or `/2fa/enable` with a setup token) an `otp_codes` row with purpose `challenge`
stores `HMAC(OTP_PEPPER, challenge|userId|jti)` until the token expires, and a partial unique index on it lets
only one of two racing requests finish. A spent token answers `401 UNAUTHENTICATED` before any code is checked.

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
  Success resets the counter. Each attempt is counted **before** the password or code is checked
  (`SELECT … FOR UPDATE` on the user row, then increment, and set `locked_until` at once when this attempt reaches
  the threshold); a right password or code gives its slot back. So parallel guesses get at most 5 checks per lock
  and one lock notice, however many are in flight.
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
- `PrismaService.withPlatformScope(role, fn)` does the same with `app.role` only: `admin` for the admin API,
  `public_read` for every storefront read (catalogue, stores, ads, CMS) that touches an RLS table, so the
  storefront keeps working when the API connects as the non-owner `app_user` role. The storefront queries
  still filter to live rows of approved sellers themselves.
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

Follow-up migrations (B2 fixes):
- `20260926160000_b2_session_revoked_reason`: `sessions.revoked_reason text` + CHECK (allowed values, only on a
  revoked row). Backfill: a revoked row followed by a newer row of its family is `rotated`; other old revoked
  rows stay NULL, which counts as revoked on purpose.
- `20260926160100_b2_challenge_single_use`: unique partial index `otp_codes (code_hash) WHERE purpose =
  'challenge'` (spent challenge tokens).
- `20260926160200_b2_pending_phone`: `users.pending_phone text` (not unique). Backfill: an unverified phone on
  an account that also has an email moves from `phone` to `pending_phone`.

## 7. Next.js apps (BFF — tokens never reach browser JavaScript)

Shared package **`@hb/auth`** (`packages/auth`, server-only, depends on `next` as a peer):
- `createAuth({ audience, loginPath, homePath })` per app; the audience also fixes SameSite (`Strict` for
  admin, `Lax` for web and seller).
- Cookie names carry the audience, so the three apps never share or overwrite each other's cookies (they all
  run on `localhost` in dev): access `hb_<audience>_at` (maxAge = access expiry), refresh `hb_<audience>_rt`
  (maxAge = refresh expiry), plus `hb_<audience>_mfa` (2FA challenge) and `hb_<audience>_pending` (code in
  flight). All `httpOnly`, `path=/`, `Secure` + `__Host-` name prefix when `NODE_ENV === 'production'`
  (`__Host-hb_web_at`, …).
- `authApi` — typed server-side client for `/v1/auth/*`, `/v1/me` (uses `NEXT_PUBLIC_API_BASE_URL` or
  `API_INTERNAL_URL`), forwarding the browser IP as `X-Forwarded-For` and the user agent. The browser IP is
  never the leftmost `X-Forwarded-For` value (the visitor can set that): it is the value of `CLIENT_IP_HEADER`
  when set (e.g. `cf-connecting-ip`, which the edge overwrites), else the entry `TRUSTED_PROXY_HOPS` (default 1)
  places from the right. Anything that is not an IP address is not forwarded. The Next servers must only be
  reachable through those proxies.
- `apiFetch` refreshes and retries only on 401 `UNAUTHENTICATED`; `INVALID_CREDENTIALS` (wrong current
  password) and `SESSION_REVOKED` are returned as they are.
- `getSession()` for server components: reads cookies, returns `Me | null` (calls `GET /me`; on 401 tries one
  refresh and retries).
- Server actions (forms, progressive enhancement, `useActionState`): login, register, verify, otp send, 2FA
  challenge / setup / enable, forgot / reset password, logout, logout-all. Next.js server actions already reject
  cross-origin posts (Origin vs Host), which is our CSRF protection for cookie-auth state changes.
- `middleware.ts` per app: protected paths without a valid-looking access cookie ⇒ try refresh (if `hb_rt`) and
  set new cookies, else redirect to `/login?next=<path>` (only same-origin relative `next` values are honoured,
  compared after the browser's dot-segment normalisation, so `/.//evil.test` is rejected).
  The middleware does **not** trust the JWT — the API verifies every call.
- **`@hb/auth/client`** — the client-safe entry with the auth UI the apps share (2FA form and panel, backup
  codes, password reset forms, resend code, captcha, contact rows with "Verify", session list and controls) and
  the field checks and copy the server also uses. Components take the app's server actions as props and never
  import the server-only entry. Generic form pieces (`useFieldErrors`, `FormAlert`, `fieldRule`) live in
  `@hb/ui`.

Pages (brand UI from `@hb/ui`; visible labels, blur-first validation, errors that never blame the user,
verb-first buttons, keyboard accessible, 360 px mobile):
- **web**: `/login` (Password | Phone code tabs), `/register`, `/verify`, `/forgot-password`, `/reset-password`,
  `/login/2fa`, `/account` (profile name, email/phone + verified state, sign-in methods, 2FA on/off with QR +
  backup codes, active sessions with "Sign out" per device and "Sign out everywhere", "Log out").
  Header account icon: logged out ⇒ `/login`; logged in ⇒ `/account`.
- **seller**: `/login` (+ `/login/2fa`), `/register` (choose **Vendor** or **Manufacturer**, store name, name,
  email, mobile, password ⇒ `/verify`), `/forgot-password`, `/reset-password`, `/dashboard` (application
  status card for draft/submitted sellers, "Start your application" for users without a seller, store name,
  log out), `/security` (email and mobile with "Verify", so a confirmed mobile number can log in; 2FA,
  sessions). `/` ⇒ `/dashboard` or `/login`.
- **admin**: `/login` ⇒ `/login/2fa` (code) or `/login/2fa/setup` (QR code SVG via `qrcode`, manual key, first
  code, then backup codes shown once with "I saved these codes"; the page asks before a reload, and after one
  it says 2FA is on instead of "timed out") ⇒ `/` overview (counts from
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
