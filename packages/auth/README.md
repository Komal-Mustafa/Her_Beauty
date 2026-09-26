# @hb/auth

Server-side auth for the Her Beauty Next.js apps (web, seller, admin). Design: `docs/b2-auth.md` §7.

The apps are a BFF: access and refresh tokens live only in httpOnly cookies, and browser
JavaScript never sees a token, password or code. Server components and server actions call the
helpers below. Every helper returns a small discriminated result (`{ status: ... }`), so one form
component can render any outcome, including errors.

| Entry                 | Runtime            | Use it from                                                             |
| --------------------- | ------------------ | ----------------------------------------------------------------------- |
| `@hb/auth`            | Node (server-only) | server components, server actions, route handlers                       |
| `@hb/auth/middleware` | Edge-safe          | the app's `middleware.ts`                                               |
| `import type` only    | any                | client components may import result types, never values from `@hb/auth` |

## Setup

```ts
// apps/web/lib/auth.ts
import { createAuth } from '@hb/auth';

export const auth = createAuth({
  audience: 'web', // 'web' | 'seller' | 'admin'
  sameSite: 'lax', // 'lax' for web and seller, 'strict' for admin
  loginPath: '/login', // where requireSession() sends visitors (default "/login")
  homePath: '/account', // landing page after login when no safe `next` was given (default "/")
});
```

```ts
// apps/web/middleware.ts
import { createAuthMiddleware } from '@hb/auth/middleware';

export const middleware = createAuthMiddleware({
  audience: 'web', // must match createAuth()
  sameSite: 'lax',
  protectedPrefixes: ['/account'], // matches "/account" and "/account/…", not "/accounting"
  loginPath: '/login',
});

export const config = { matcher: ['/account/:path*'] };
```

### Environment

| Variable                   | Meaning                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------ |
| `API_INTERNAL_URL`         | Server-to-server API base URL, including `/v1` (e.g. `http://api.internal:4000/v1`). |
| `NEXT_PUBLIC_API_BASE_URL` | Used when `API_INTERNAL_URL` is not set.                                             |

Both are read at call time. In development the fallback is `http://localhost:4000/v1`; in
production a missing URL throws. No secrets are needed: the apps never verify or sign tokens.

Every API call forwards the visitor's IP (first `X-Forwarded-For` value, else `x-real-ip`) and
`User-Agent`, uses `cache: 'no-store'` and times out after 10 s. Only trust `X-Forwarded-For`
when the app runs behind a proxy that overwrites it.

### Cookies

| Cookie       | Holds                                         | Max-Age                   |
| ------------ | --------------------------------------------- | ------------------------- |
| `hb_at`      | access token (JWT)                            | until the token expires   |
| `hb_rt`      | rotating refresh token                        | until the session expires |
| `hb_mfa`     | 2FA challenge token between password and code | 5 min (or less)           |
| `hb_pending` | the code in flight: target, channel, purpose  | 15 min                    |

All are `httpOnly`, `path=/` and use the `sameSite` from the config. In production they are
`Secure` and named with the `__Host-` prefix (`__Host-hb_at`, …), so no subdomain can read or
set them. `cookieNames()` and `cookieOptions(sameSite, maxAgeSec)` are exported for code that
needs the same names.

## Sessions

```ts
const user = await auth.getSession(); // Me | null. Memoized per request (React cache).
const user = await auth.requireSession('/account/orders'); // Me, or redirect to /login?next=…
```

- `getSession()` returns `null` when there are no cookies or the API says 401. Other failures
  (API down, bad response) throw an `ApiRequestError`, so a page can tell "signed out" from
  "outage". Wrap it when an outage should count as signed out:

  ```ts
  export async function signedInUser() {
    try {
      return await auth.getSession();
    } catch {
      return null;
    }
  }
  ```

- In a server component, cookies are read-only, so an expired access token cannot be
  refreshed there. The middleware refreshes it before protected pages render. In server actions
  and route handlers, `apiFetch` refreshes by itself.

### `apiFetch(path, schema, init?)`

Calls the API as the signed-in user and validates the response with any object that has
`parse(input: unknown): T` (every zod schema from `@hb/types` fits).

```ts
import { ApiRequestError, IgnoreBody } from '@hb/auth';
import { Me } from '@hb/types';

const me = await auth.apiFetch('/me', Me);
await auth.apiFetch(`/auth/sessions/${encodeURIComponent(id)}`, IgnoreBody, { method: 'DELETE' });

try {
  await auth.apiFetch('/me', Me, { method: 'PATCH', body: { fullName } });
} catch (error) {
  if (error instanceof ApiRequestError && error.code === 'RATE_LIMITED') {
    // error.details.retryAfterSec
  }
  throw error;
}
```

- `init` is `{ method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown }`. The
  body is sent as JSON.
- With no access cookie, it refreshes first (when cookies are writable). On a 401 it refreshes
  once and retries once.
- `IgnoreBody` is a schema that accepts any body (for 204s and responses you don't need).
- Failures throw `ApiRequestError`:

  | Field     | Meaning                                                                                |
  | --------- | -------------------------------------------------------------------------------------- |
  | `status`  | HTTP status, or `0` when the API was unreachable                                       |
  | `code`    | API error code (`INVALID_CREDENTIALS`, `RATE_LIMITED`, …) or `NETWORK`, `BAD_RESPONSE` |
  | `message` | the API's message (log it, don't show it)                                              |
  | `details` | `{ retryAfterSec?, captchaRequired?, issues? }`                                        |

  `friendlyMessage(code, details)` gives copy that is safe to show.

Refreshes are single-flight: requests that hold the same refresh token share one rotation, and
its result is reused for 10 s. The API still sees two rotations if two server processes refresh
the same token at once; see "Known limits".

## Form helpers

Each helper takes the action's `FormData` (or a plain object), validates it with the
`@hb/types` schemas, calls the API, sets or clears cookies, and returns a result. Nothing throws
for expected failures: you get `{ status: 'error', code, message, fieldErrors?, values?,
retryAfterSec?, captchaRequired? }` (`AuthError`).

- `message` is friendly and safe to render.
- `fieldErrors` maps field names to messages, for `aria-invalid` and inline errors.
- `values` echoes non-secret fields (identifier, name, email, phone) so the form keeps them.
  Passwords and codes are never echoed.
- `captchaRequired` means the next try must send a Turnstile token (`captchaToken` or
  `cf-turnstile-response` field).
- Unexpected errors (bugs, Next's redirect signal) are re-thrown, never disguised as form errors.

| Helper                    | Reads fields                                                                                  | Success result                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `login(fd)`               | `identifier`, `password`, `next?`                                                             | `{status:'ok', user, next}` · `{status:'mfa_required', next}` · `{status:'mfa_setup_required', next}` |
| `register(fd)`            | `fullName`, `email?`, `phone?`, `password`, `next?` (+ `storeName`, `sellerType` for seller)  | `{status:'verification_sent', channel, target}` (target masked)                                       |
| `sendOtp(fd)`             | `target` (or `phone`/`email`), `channel?`, `purpose?` (`login` default, or `verify`), `next?` | `{status:'sent', channel, target, expiresInSec}`                                                      |
| `resendCode()`            | the `hb_pending` cookie                                                                       | same as `sendOtp`; `RESEND_TOO_SOON` with `retryAfterSec` inside the 60 s cooldown                    |
| `verifyOtp(fd)`           | `code`, `fullName?` (target comes from `hb_pending`)                                          | a login outcome, or `{status:'profile_required'}` (ask for `fullName`, post again without a code)     |
| `challenge2fa(fd)`        | `code` (TOTP or backup code; token from `hb_mfa`)                                             | a login outcome; `MFA_EXPIRED` when the 5 minutes ran out                                             |
| `setup2fa()`              | signed-in user, or `hb_mfa` of kind `mfa_setup`                                               | `{status:'ok', secret, otpauthUri, qrDataUrl}`                                                        |
| `enable2fa(fd)`           | `code`                                                                                        | `{status:'ok', backupCodes, user?, next?}` (`user`/`next` when it finished a setup-required login)    |
| `disable2fa(fd)`          | `password`, `code`                                                                            | `{status:'ok'}`                                                                                       |
| `forgotPassword(fd)`      | `identifier`                                                                                  | `{status:'sent', channel, target, expiresInSec}` (same answer whether or not the account exists)      |
| `resetPassword(fd)`       | `code`, `newPassword` (identifier from `hb_pending`, or an `identifier` field)                | `{status:'ok'}`; clears the session cookies (the API ends every session)                              |
| `logout()`                | cookies                                                                                       | `{status:'ok'}`; always clears the cookies, even when the API is down                                 |
| `logoutAll()`             | session                                                                                       | `{status:'ok'}`; clears this browser's cookies too                                                    |
| `listSessions()`          | session                                                                                       | `SessionInfo[]` (throws `ApiRequestError`)                                                            |
| `revokeSession(fd \| id)` | `id`                                                                                          | `{status:'ok'}`; `NOT_FOUND` says the device is already signed out                                    |
| `updateProfile(fd)`       | `fullName`                                                                                    | `{status:'ok', user}`                                                                                 |

Reading state for the code pages:

```ts
const pending = await auth.getPending();
// { channel, target (masked), purpose: 'login'|'verify'|'reset', resendInSec, next, needsName } | null
const challenge = await auth.getMfaChallenge(); // { kind: 'mfa'|'mfa_setup', next } | null
```

`next` values are always passed through `safeNextPath`, so a login can never redirect off-site.
After a successful login the previous session in this browser (if any) is revoked.

### Server action pattern

Keep `redirect()` outside `try/catch`: it works by throwing.

```ts
'use server';
import type { LoginResultState } from '@hb/auth';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export async function loginAction(
  _prev: LoginResultState | null,
  formData: FormData,
): Promise<LoginResultState> {
  const result = await auth.login(formData);
  if (result.status === 'ok') redirect(result.next);
  if (result.status !== 'error') redirect('/login/2fa');
  return result;
}
```

```tsx
'use client';
import type { LoginResultState } from '@hb/auth';
import { Alert, Input, PasswordInput, SubmitButton } from '@hb/ui';
import { useActionState } from 'react';
import { loginAction } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<LoginResultState | null, FormData>(loginAction, null);
  const error = state?.status === 'error' ? state : null;
  return (
    <form action={action} noValidate>
      {error && <Alert tone="danger">{error.message}</Alert>}
      <input type="hidden" name="next" value={next} />
      <Input
        label="Email or mobile number"
        name="identifier"
        defaultValue={error?.values?.identifier}
        error={error?.fieldErrors?.identifier}
      />
      <PasswordInput label="Password" name="password" error={error?.fieldErrors?.password} />
      <SubmitButton pendingLabel="Logging in…">Log in</SubmitButton>
    </form>
  );
}
```

The form posts without JavaScript too. Next.js rejects cross-origin server-action posts, which
is the CSRF guard (b2-auth §7).

Form components from `@hb/ui` made for these pages (all work without JavaScript):

| Component       | Notes                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| `PasswordInput` | `Input` with a show/hide button (`aria-pressed`)                                         |
| `CodeInput`     | digits only, `autoComplete="one-time-code"`; `length`, `onValueChange`, `onComplete`     |
| `SubmitButton`  | reads `useFormStatus()`; shows a spinner and `pendingLabel` while the action runs        |
| `Alert`         | `tone`: `info`, `success`, `warning`, `danger` (danger is `role="alert"`, others status) |
| `Tabs`          | WAI-ARIA tabs; give each tab an `href` so it also switches without JavaScript            |

`apps/web/components/auth/use-field-errors.ts` adds blur-first validation on top of this and puts
typed values back after an error (React resets a form after its action runs). Copy it if the
seller or admin app wants the same behaviour.

## Utilities

### `safeNextPath(raw, fallback)`

Returns `raw` only when it is a same-origin path (`/account?tab=2#x`), else `fallback`. Rejects
`//host`, `/\host`, any backslash, control characters, absolute URLs and values over 2048
characters.

```ts
safeNextPath('/account/orders', '/'); // '/account/orders'
safeNextPath('//evil.test', '/'); // '/'
safeNextPath('https://evil.test', '/'); // '/'
```

Also exported from `@hb/auth/middleware`.

### `qrSvgDataUrl(otpauthUri)`

Renders an `otpauth://` URI as an SVG QR code and returns a `data:image/svg+xml;base64,…` URL
for an `<img src>`. Anything that is not `otpauth://` is rejected. `setup2fa()` already returns
it as `qrDataUrl`.

## Middleware (`@hb/auth/middleware`)

For each request to a protected prefix:

1. A live-looking access cookie (JWT `exp` more than 30 s away; the signature is not checked,
   the API checks it) passes straight through.
2. No refresh cookie: redirect to `loginPath?next=<path>`.
3. Otherwise it rotates the refresh token, sets the new cookies on the response, and passes the
   new cookies to the page render in the same request.
4. A rejected refresh token (401/400) clears the cookies and redirects to login. An unreachable
   API passes through and lets the page decide.

It never refreshes for router prefetches, or for the server-side fetch Next makes to render the
target of a server-action redirect (`rsc: 1` without `next-router-state-tree`). Next drops the
`Set-Cookie` of those responses, so the browser would keep a revoked refresh token and its next
refresh would look like token theft.

`isProtectedPath(pathname, prefixes)`, `accessTokenLooksLive(token, nowMs, skewSec = 30)`,
`jwtExpiry(token)` and `safeNextPath` are exported for custom middleware.

## App notes (learned on apps/web)

- **No `loading.tsx` on pages with server-action forms.** With Next 15.5, an action on a page
  that has a `loading.tsx` sometimes stays pending forever even though the server answered.
  `/account` has none for this reason.
- **Links to protected pages use `prefetch={false}`.** A prefetch cannot refresh a session (see
  above), so it would only fetch a login redirect in the background. The header link to
  `/account` stays a plain static link; the middleware sends signed-out visitors to login.
- **Add `@hb/ui` to `experimental.optimizePackageImports`** in `next.config.ts`. It cut the
  First Load JS of the auth pages from about 224 kB to about 157 kB.
- Pages that call `getSession()` or read cookies are dynamic. Keep them out of layouts that must
  stay static (the web header and homepage do not call it).

## Testing

```sh
pnpm --filter @hb/auth test
```

`createAuthCore(config, deps)` is the framework-free core behind `createAuth`: pass a fake cookie
jar, headers, `redirect`, `fetch` and `now` (see `src/test-support.ts` and `src/core.test.ts`).
`createAuthMiddleware` accepts `fetch` and `now` for the same reason.

## Known limits

- Two server processes refreshing the same token at the same moment both call the API; the
  second one looks like reuse unless the API allows a short grace window.
- In development the cookies have no `__Host-` prefix, so apps on different localhost ports
  share them. Use one app at a time, or different browsers.
