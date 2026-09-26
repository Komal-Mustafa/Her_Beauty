// The auth helpers behind createAuth(), with their Next.js dependencies injected so they can be
// unit-tested. Design: docs/b2-auth.md §3 and §7.
import {
  CodeSent,
  ContactVerifyRequest,
  Email,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResult,
  Me,
  OtpSendRequest,
  OtpVerifyRequest,
  PhoneInput,
  RegisterRequest,
  ResetPasswordRequest,
  SessionInfo,
  TokenPair,
  TwoFactorChallengeRequest,
  TwoFactorDisableRequest,
  TwoFactorEnableRequest,
  TwoFactorEnabled,
  TwoFactorSetup,
  UpdateMeRequest,
  VerificationSent,
  type AuthAudience,
  type OtpChannel,
} from '@hb/types';
import {
  clearCookie,
  cookieNames,
  cookieOptions,
  MFA_COOKIE_MAX_AGE_SEC,
  PENDING_COOKIE_MAX_AGE_SEC,
  sameSiteFor,
  writeTokenCookies,
  type CookieNames,
  type CookieWriter,
  type SameSite,
} from './cookies';
import { FIELD_MESSAGES, RESEND_COOLDOWN_SEC, SECOND_FACTOR_CODE_MESSAGES } from './copy';
import { ApiRequestError } from './errors';
import {
  captchaToken,
  channelFor,
  maskTarget,
  pickValues,
  readInput,
  type HelperInput,
} from './form';
import {
  callApi,
  clientForwardHeaders,
  IgnoreBody,
  type ApiCall,
  type FetchLike,
  type HeaderReader,
  type HttpMethod,
  type Schema,
} from './http';
import { qrSvgDataUrl } from './qr';
import { refreshOnce } from './refresh';
import {
  invalid,
  makeError,
  toAuthError,
  type AuthError,
  type CodeSentState,
  type DoneState,
  type ErrorContext,
  type FieldMessages,
  type LoginOutcome,
  type LoginResultState,
  type ProfileState,
  type RegisterResultState,
  type TwoFactorEnableState,
  type TwoFactorSetupState,
  type VerifyResultState,
} from './results';
import { safeNextPath } from './safe-next';
import {
  decodeMfa,
  decodePending,
  encodeState,
  type MfaState,
  type PendingPurpose,
  type PendingState,
} from './state-cookies';

export type AuthConfig = {
  /** Also decides the cookie names and SameSite (Strict for admin, Lax otherwise; b2-auth §7). */
  audience: AuthAudience;
  /** Where requireSession() sends logged-out visitors. Default "/login". */
  loginPath?: string;
  /** Default landing page after login when no safe `next` was given. Default "/". */
  homePath?: string;
};

/** The part of next/headers `cookies()` the helpers use. */
export interface CookieJar extends CookieWriter {
  get(name: string): { value: string } | undefined;
}

export type AuthDeps = {
  cookies: () => Promise<CookieJar>;
  headers: () => Promise<HeaderReader>;
  redirect: (url: string) => never;
  fetch?: FetchLike;
  now?: () => number;
  /** Per-request memo for getSession (React `cache` in server components). */
  memo?: <T>(fn: () => Promise<T>) => () => Promise<T>;
};

export type ApiFetchInit = { method?: HttpMethod; body?: unknown };

export { RESEND_COOLDOWN_SEC };

const FIELDS = FIELD_MESSAGES satisfies FieldMessages;

const SessionList: Schema<SessionInfo[]> = {
  parse(input) {
    const items =
      typeof input === 'object' && input !== null && !Array.isArray(input) && 'items' in input
        ? (input as { items: unknown }).items
        : input;
    return SessionInfo.array().parse(items);
  },
};

export type PendingView = {
  channel: OtpChannel;
  /** Masked target for display. */
  target: string;
  purpose: PendingPurpose;
  /** Seconds until "Resend code" works (0 = now). */
  resendInSec: number;
  next: string;
  /** The code was right but the account needs a name first (PROFILE_REQUIRED). */
  needsName: boolean;
};

export type MfaView = { kind: MfaState['kind']; next: string };

export function createAuthCore(config: AuthConfig, deps: AuthDeps) {
  const { audience } = config;
  const sameSite: SameSite = sameSiteFor(audience);
  const loginPath = config.loginPath ?? '/login';
  const homePath = config.homePath ?? '/';
  const now = deps.now ?? Date.now;
  const names = (): CookieNames => cookieNames(audience);

  // ---------- plumbing ----------

  async function call<T>(path: string, schema: Schema<T>, init: ApiCall = {}): Promise<T> {
    const forward = clientForwardHeaders(await deps.headers());
    return callApi(path, schema, { ...init, forward, fetch: deps.fetch });
  }

  /**
   * Server components get read-only cookies. Refreshing there would rotate the refresh token
   * without being able to store the new one, and the browser's next refresh would then look like
   * token reuse (every session revoked). So we only refresh where cookies can be written; clearing
   * the rejected access cookie doubles as the check.
   */
  function canWriteCookies(jar: CookieJar): boolean {
    try {
      clearCookie(jar, names().access, sameSite);
      return true;
    } catch {
      return false;
    }
  }

  function clearIfPresent(jar: CookieJar, name: string): void {
    if (jar.get(name)) clearCookie(jar, name, sameSite);
  }

  function clearSessionCookies(jar: CookieJar): void {
    const n = names();
    for (const name of [n.access, n.refresh, n.mfa, n.pending]) clearIfPresent(jar, name);
  }

  /** New access token, or null when there is no usable refresh token (cookies then cleared). */
  async function refresh(jar: CookieJar): Promise<string | null> {
    const n = names();
    const refreshToken = jar.get(n.refresh)?.value;
    if (!refreshToken || !canWriteCookies(jar)) return null;
    try {
      const tokens = await refreshOnce(
        refreshToken,
        () => call('/auth/refresh', TokenPair, { method: 'POST', body: { refreshToken } }),
        now,
      );
      writeTokenCookies(jar, n, tokens, sameSite, now());
      return tokens.accessToken;
    } catch (error) {
      if (error instanceof ApiRequestError && (error.status === 401 || error.status === 400)) {
        clearSessionCookies(jar);
        return null;
      }
      throw error;
    }
  }

  /**
   * Authenticated API call: Bearer from the access cookie, one refresh + retry when the API says
   * the access token is unusable, response parsed with `schema`. Throws ApiRequestError (with the
   * API error code) on failure.
   *
   * Only `UNAUTHENTICATED` (missing, invalid or expired access token) refreshes. Other 401s are
   * answers about the request itself: INVALID_CREDENTIALS (a wrong password on /auth/2fa/disable)
   * must not be sent twice, since each try counts toward the lockout, and SESSION_REVOKED means the
   * refresh token is dead too, so presenting it would only look like token theft.
   */
  async function apiFetch<T>(path: string, schema: Schema<T>, init: ApiFetchInit = {}): Promise<T> {
    const jar = await deps.cookies();
    const unauthenticated = () => new ApiRequestError(401, 'UNAUTHENTICATED', 'No usable session.');
    let access = jar.get(names().access)?.value || (await refresh(jar));
    if (!access) throw unauthenticated();
    try {
      return await call(path, schema, { ...init, bearer: access });
    } catch (error) {
      if (!(error instanceof ApiRequestError) || error.code !== 'UNAUTHENTICATED') throw error;
      access = await refresh(jar);
      if (!access) throw error;
      return call(path, schema, { ...init, bearer: access });
    }
  }

  async function getSessionUncached(): Promise<Me | null> {
    const jar = await deps.cookies();
    const n = names();
    if (!jar.get(n.access)?.value && !jar.get(n.refresh)?.value) return null;
    try {
      return await apiFetch('/me', Me);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) return null;
      throw error;
    }
  }

  /** The signed-in user, or null. Throws only when the API is unreachable or broken. */
  const getSession = deps.memo ? deps.memo(getSessionUncached) : getSessionUncached;

  function loginUrl(nextPath?: string): string {
    const next = safeNextPath(nextPath, homePath);
    return `${loginPath}?next=${encodeURIComponent(next)}`;
  }

  /** The signed-in user; otherwise redirects to `loginPath?next=<nextPath>`. */
  async function requireSession(nextPath?: string): Promise<Me> {
    const me = await getSession();
    if (!me) deps.redirect(loginUrl(nextPath));
    return me as Me;
  }

  // ---------- state cookies ----------

  function readPending(jar: CookieJar): PendingState | null {
    const state = decodePending(jar.get(names().pending)?.value);
    return state ? { ...state, next: safeNextPath(state.next, homePath) } : null;
  }

  function writePending(jar: CookieJar, state: PendingState): void {
    jar.set(
      names().pending,
      encodeState(state),
      cookieOptions(sameSite, PENDING_COOKIE_MAX_AGE_SEC),
    );
  }

  function readMfa(jar: CookieJar): MfaState | null {
    const state = decodeMfa(jar.get(names().mfa)?.value);
    return state ? { ...state, next: safeNextPath(state.next, homePath) } : null;
  }

  function resendInSec(state: PendingState): number {
    const elapsed = Math.floor((now() - state.sentAt) / 1000);
    return Math.max(0, RESEND_COOLDOWN_SEC - elapsed);
  }

  /** What the /verify and /reset-password pages show (masked target, cooldown), or null. */
  async function getPending(): Promise<PendingView | null> {
    const state = readPending(await deps.cookies());
    if (!state) return null;
    return {
      channel: state.channel,
      target: state.display,
      purpose: state.purpose,
      resendInSec: resendInSec(state),
      next: state.next,
      needsName: Boolean(state.code),
    };
  }

  /** Whether a 2FA step is waiting (the challenge token itself never leaves the server). */
  async function getMfaChallenge(): Promise<MfaView | null> {
    const state = readMfa(await deps.cookies());
    return state ? { kind: state.kind, next: state.next } : null;
  }

  // ---------- login results ----------

  /** Best effort: a new login replaces the session this browser had (never blocks the login). */
  async function revokePrevious(jar: CookieJar, newRefreshToken: string): Promise<void> {
    const old = jar.get(names().refresh)?.value;
    if (!old || old === newRefreshToken) return;
    try {
      await call('/auth/logout', IgnoreBody, { method: 'POST', body: { refreshToken: old } });
    } catch (error) {
      if (!(error instanceof ApiRequestError)) throw error;
      // The old session may already be gone; either way the new login stands.
    }
  }

  async function applyLogin(
    jar: CookieJar,
    result: LoginResult,
    next: string,
  ): Promise<LoginOutcome> {
    const n = names();
    if (result.status === 'ok') {
      await revokePrevious(jar, result.tokens.refreshToken);
      writeTokenCookies(jar, n, result.tokens, sameSite, now());
      clearIfPresent(jar, n.mfa);
      clearIfPresent(jar, n.pending);
      return { status: 'ok', user: result.user, next };
    }
    const state: MfaState = {
      v: 1,
      token: result.challengeToken,
      kind: result.status === 'mfa_required' ? 'mfa' : 'mfa_setup',
      next,
    };
    jar.set(
      n.mfa,
      encodeState(state),
      cookieOptions(sameSite, Math.min(result.expiresInSec, MFA_COOKIE_MAX_AGE_SEC)),
    );
    clearIfPresent(jar, n.pending);
    return { status: result.status, next };
  }

  /**
   * Stores a token pair the API issued outside these helpers, e.g. POST /seller/application, which
   * rotates the session so the new tokens carry the seller context. The old refresh token is
   * already revoked (presenting it again would look like token theft and end every session), so
   * the new pair replaces the cookies at once. A leftover 2FA step or code log-in is finished
   * business; a pending verify or reset code (made while signed in) is kept.
   * Server actions and route handlers only: cookies are read-only in server components.
   */
  async function adoptTokens(tokens: TokenPair): Promise<void> {
    const jar = await deps.cookies();
    const n = names();
    writeTokenCookies(jar, n, tokens, sameSite, now());
    clearIfPresent(jar, n.mfa);
    if (readPending(jar)?.purpose === 'login') clearCookie(jar, n.pending, sameSite);
  }

  /** Runs an API step and maps ApiRequestError to an AuthError with the given context. */
  async function attempt<R>(ctx: ErrorContext, step: () => Promise<R>): Promise<R | AuthError> {
    try {
      return await step();
    } catch (error) {
      return toAuthError(error, ctx);
    }
  }

  // ---------- public helpers ----------

  async function login(input: HelperInput): Promise<LoginResultState> {
    const data = readInput(input);
    const next = safeNextPath(data.next, homePath);
    const ctx: ErrorContext = { values: pickValues(data, ['identifier']), fields: FIELDS };
    const parsed = LoginRequest.safeParse({
      audience,
      identifier: data.identifier,
      password: data.password,
      captchaToken: captchaToken(data),
    });
    if (!parsed.success) return invalid(parsed.error.issues, ctx);
    return attempt(ctx, async () => {
      const result = await call('/auth/login', LoginResult, { method: 'POST', body: parsed.data });
      return applyLogin(await deps.cookies(), result, next);
    });
  }

  async function register(input: HelperInput): Promise<RegisterResultState> {
    const data = readInput(input);
    const next = safeNextPath(data.next, homePath);
    const ctx: ErrorContext = {
      values: pickValues(data, ['fullName', 'email', 'phone', 'storeName', 'sellerType']),
      fields: { ...FIELDS, password: FIELDS.newPassword },
      passwordField: 'password',
    };
    if (audience === 'web' && !data.email && !data.phone) {
      return makeError('VALIDATION_FAILED', {
        ...ctx,
        messages: {
          VALIDATION_FAILED: 'Add an email or a mobile number so we can send your code.',
        },
      });
    }
    const parsed = RegisterRequest.safeParse({
      audience,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      password: data.password,
      captchaToken: captchaToken(data),
      ...(audience === 'seller' ? { sellerType: data.sellerType, storeName: data.storeName } : {}),
    });
    if (!parsed.success) return invalid(parsed.error.issues, ctx);
    const body = parsed.data;
    return attempt(ctx, async () => {
      const sent = await call('/auth/register', VerificationSent, { method: 'POST', body });
      const target =
        (sent.channel === 'email' ? body.email : body.phone) ?? body.email ?? body.phone;
      if (target) {
        writePending(await deps.cookies(), {
          v: 1,
          target,
          display: sent.target,
          channel: sent.channel,
          purpose: 'verify',
          sentAt: now(),
          next,
        });
      }
      return { status: 'verification_sent', channel: sent.channel, target: sent.target } as const;
    });
  }

  function targetFields(channel: OtpChannel): FieldMessages {
    return { ...FIELDS, target: channel === 'email' ? FIELDS.email : FIELDS.phone };
  }

  /** Sends a login (or verify) code and remembers the target for /verify. */
  async function sendOtp(input: HelperInput): Promise<CodeSentState> {
    const data = readInput(input);
    const next = safeNextPath(data.next, homePath);
    const rawTarget = data.target ?? data.phone ?? data.email ?? '';
    const channel: OtpChannel =
      data.channel === 'email' || data.channel === 'sms' ? data.channel : channelFor(rawTarget);
    const purpose = data.purpose === 'verify' ? 'verify' : 'login';
    const ctx: ErrorContext = {
      values: pickValues(data, ['target']),
      fields: targetFields(channel),
    };
    const targetCheck = (channel === 'email' ? Email : PhoneInput).safeParse(rawTarget);
    if (!targetCheck.success) return invalid([{ path: ['target'] }], ctx);
    const parsed = OtpSendRequest.safeParse({
      audience,
      channel,
      target: targetCheck.data,
      purpose,
      captchaToken: captchaToken(data),
    });
    if (!parsed.success) return invalid(parsed.error.issues, ctx);
    return attempt(ctx, async () => {
      const sent = await call('/auth/otp/send', CodeSent, { method: 'POST', body: parsed.data });
      const display = maskTarget(parsed.data.target, channel);
      writePending(await deps.cookies(), {
        v: 1,
        target: parsed.data.target,
        display,
        channel,
        purpose,
        sentAt: now(),
        next,
      });
      return { status: 'sent', channel, target: display, expiresInSec: sent.expiresInSec } as const;
    });
  }

  /**
   * Sends a code to confirm the signed-in user's own email or mobile number (`channel`), then
   * /verify finishes it. The API takes the address from the session, never from the form; the
   * one kept here is only for display.
   */
  async function sendContactVerification(input: HelperInput): Promise<CodeSentState> {
    const data = readInput(input);
    const channel: OtpChannel = data.channel === 'email' ? 'email' : 'sms';
    let me: Me | null;
    try {
      me = await getSession();
    } catch (error) {
      return toAuthError(error);
    }
    if (!me) return makeError('UNAUTHENTICATED');
    const target = channel === 'email' ? me.email : me.phone;
    const what = channel === 'email' ? 'email address' : 'mobile number';
    if (!target) {
      return makeError('VALIDATION_FAILED', {
        messages: { VALIDATION_FAILED: `There’s no ${what} on your account to confirm yet.` },
      });
    }
    const ctx: ErrorContext = {
      messages: { CONFLICT: `Your ${what} is already confirmed. Refresh the page to see it.` },
    };
    return attempt(ctx, async () => {
      const sent = await apiFetch('/me/contacts/send', CodeSent, {
        method: 'POST',
        body: { channel },
      });
      const display = maskTarget(target, channel);
      writePending(await deps.cookies(), {
        v: 1,
        target,
        display,
        channel,
        purpose: 'contact',
        sentAt: now(),
        next: safeNextPath(data.next, homePath),
      });
      return { status: 'sent', channel, target: display, expiresInSec: sent.expiresInSec } as const;
    });
  }

  /**
   * Checks a contact code. A 409 means the address is confirmed already (another tab got there
   * first: that counts as done) or, for a mobile number, that another account holds it.
   */
  async function verifyContact(
    jar: CookieJar,
    state: PendingState,
    code: string | undefined,
    ctx: ErrorContext,
  ): Promise<VerifyResultState> {
    const parsed = ContactVerifyRequest.safeParse({ channel: state.channel, code });
    if (!parsed.success) return invalid(parsed.error.issues, ctx);
    const done = (user: Me) => {
      clearIfPresent(jar, names().pending);
      return { status: 'ok', user, next: state.next } as const;
    };
    try {
      return done(await apiFetch('/me/contacts/verify', Me, { method: 'POST', body: parsed.data }));
    } catch (error) {
      if (!(error instanceof ApiRequestError && error.code === 'CONFLICT')) {
        return toAuthError(error, ctx);
      }
      const me = await getSessionUncached().catch(() => null);
      if (me && (state.channel === 'email' ? me.emailVerified : me.phoneVerified)) return done(me);
      // The cookie stays, so /verify keeps showing this message and its way back (clearing a
      // cookie in a server action re-renders the page, which would show "timed out" instead).
      return makeError('CONFLICT', {
        messages: {
          CONFLICT:
            'This mobile number is already on another Her Beauty account. Log in with it instead, or contact support.',
        },
      });
    }
  }

  /** Sends a fresh code for whatever /verify or /reset-password is waiting on. */
  async function resendCode(): Promise<CodeSentState> {
    const jar = await deps.cookies();
    const state = readPending(jar);
    if (!state) return makeError('PENDING_EXPIRED');
    const wait = resendInSec(state);
    if (wait > 0) return makeError('RESEND_TOO_SOON', {}, { retryAfterSec: wait });
    return attempt({}, async () => {
      let expiresInSec = 300;
      if (state.purpose === 'reset') {
        await call('/auth/password/forgot', IgnoreBody, {
          method: 'POST',
          body: { audience, identifier: state.target },
        });
      } else if (state.purpose === 'contact') {
        const sent = await apiFetch('/me/contacts/send', CodeSent, {
          method: 'POST',
          body: { channel: state.channel },
        });
        expiresInSec = sent.expiresInSec;
      } else {
        const sent = await call('/auth/otp/send', CodeSent, {
          method: 'POST',
          body: { audience, channel: state.channel, target: state.target, purpose: state.purpose },
        });
        expiresInSec = sent.expiresInSec;
      }
      const { code: _dropped, ...rest } = state;
      writePending(jar, { ...rest, sentAt: now() });
      return {
        status: 'sent',
        channel: state.channel,
        target: state.display,
        expiresInSec,
      } as const;
    });
  }

  /** Checks the code for the pending login/verify. PROFILE_REQUIRED asks for a name first. */
  async function verifyOtp(input: HelperInput): Promise<VerifyResultState> {
    const data = readInput(input);
    const jar = await deps.cookies();
    const state = readPending(jar);
    const ctx: ErrorContext = {
      values: pickValues(data, ['fullName']),
      fields: FIELDS,
      codeField: 'code',
    };
    if (!state || state.purpose === 'reset') return makeError('PENDING_EXPIRED', ctx);
    if (state.purpose === 'contact') {
      return verifyContact(jar, state, data.code?.replace(/\s+/g, ''), ctx);
    }
    const code = data.code?.replace(/\s+/g, '') ?? state.code;
    const parsed = OtpVerifyRequest.safeParse({
      audience,
      channel: state.channel,
      target: state.target,
      purpose: state.purpose,
      code,
      fullName: data.fullName,
    });
    if (!parsed.success) return invalid(parsed.error.issues, ctx);
    try {
      const result = await call('/auth/otp/verify', LoginResult, {
        method: 'POST',
        body: parsed.data,
      });
      return await applyLogin(jar, result, state.next);
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'PROFILE_REQUIRED') {
        writePending(jar, { ...state, code: parsed.data.code });
        return { status: 'profile_required' };
      }
      if (error instanceof ApiRequestError && error.code === 'INVALID_CODE' && state.code) {
        const { code: _dropped, ...rest } = state;
        writePending(jar, rest);
      }
      return toAuthError(error, ctx);
    }
  }

  /** Finishes a password login with a TOTP or backup code (challenge token from hb_<audience>_mfa). */
  async function challenge2fa(input: HelperInput): Promise<LoginResultState> {
    const data = readInput(input);
    const jar = await deps.cookies();
    const mfa = readMfa(jar);
    const ctx: ErrorContext = {
      fields: { ...FIELDS, code: FIELD_MESSAGES.secondFactor },
      codeField: 'code',
      messages: { INVALID_CODE: SECOND_FACTOR_CODE_MESSAGES.challenge },
    };
    if (!mfa || mfa.kind !== 'mfa') return makeError('MFA_EXPIRED', ctx);
    const parsed = TwoFactorChallengeRequest.safeParse({
      challengeToken: mfa.token,
      code: data.code,
    });
    if (!parsed.success) return invalid(parsed.error.issues, ctx);
    try {
      const result = await call('/auth/2fa/challenge', LoginResult, {
        method: 'POST',
        body: parsed.data,
      });
      return await applyLogin(jar, result, mfa.next);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        clearIfPresent(jar, names().mfa);
        return makeError('MFA_EXPIRED', ctx);
      }
      return toAuthError(error, ctx);
    }
  }

  /** Starts TOTP enrolment: signed-in user (Bearer) or admin first sign-in (setup challenge). */
  async function setup2fa(): Promise<TwoFactorSetupState> {
    const jar = await deps.cookies();
    const mfa = readMfa(jar);
    return attempt({}, async () => {
      const setup =
        mfa?.kind === 'mfa_setup'
          ? await call('/auth/2fa/setup', TwoFactorSetup, {
              method: 'POST',
              body: { challengeToken: mfa.token },
            })
          : await apiFetch('/auth/2fa/setup', TwoFactorSetup, { method: 'POST', body: {} });
      const qrDataUrl = await qrSvgDataUrl(setup.otpauthUri);
      return {
        status: 'ok',
        secret: setup.secret,
        otpauthUri: setup.otpauthUri,
        qrDataUrl,
      } as const;
    });
  }

  /** Confirms the first TOTP code; returns the 10 backup codes (show once). */
  async function enable2fa(input: HelperInput): Promise<TwoFactorEnableState> {
    const data = readInput(input);
    const jar = await deps.cookies();
    const mfa = readMfa(jar);
    const ctx: ErrorContext = {
      fields: FIELDS,
      codeField: 'code',
      messages: { INVALID_CODE: SECOND_FACTOR_CODE_MESSAGES.enable },
    };
    const setupToken = mfa?.kind === 'mfa_setup' ? mfa.token : undefined;
    const parsed = TwoFactorEnableRequest.safeParse({
      challengeToken: setupToken,
      code: data.code?.replace(/\s+/g, ''),
    });
    if (!parsed.success) return invalid(parsed.error.issues, ctx);
    return attempt(ctx, async () => {
      const init = { method: 'POST' as const, body: parsed.data };
      const enabled = setupToken
        ? await call('/auth/2fa/enable', TwoFactorEnabled, init)
        : await apiFetch('/auth/2fa/enable', TwoFactorEnabled, init);
      if (enabled.login && mfa) {
        const outcome = await applyLogin(jar, enabled.login, mfa.next);
        if (outcome.status === 'ok') {
          return {
            status: 'ok',
            backupCodes: enabled.backupCodes,
            user: outcome.user,
            next: outcome.next,
          } as const;
        }
      }
      return { status: 'ok', backupCodes: enabled.backupCodes } as const;
    });
  }

  async function disable2fa(input: HelperInput): Promise<DoneState> {
    const data = readInput(input);
    const ctx: ErrorContext = {
      fields: { ...FIELDS, code: FIELD_MESSAGES.secondFactor },
      codeField: 'code',
      messages: {
        INVALID_CREDENTIALS: 'Your password didn’t match. Check it and try again.',
        INVALID_CODE: SECOND_FACTOR_CODE_MESSAGES.challenge,
      },
    };
    const parsed = TwoFactorDisableRequest.safeParse({ password: data.password, code: data.code });
    if (!parsed.success) return invalid(parsed.error.issues, ctx);
    return attempt(ctx, async () => {
      await apiFetch('/auth/2fa/disable', IgnoreBody, { method: 'POST', body: parsed.data });
      return { status: 'ok' } as const;
    });
  }

  /** Sends a reset code when the account exists (the API always answers the same). */
  async function forgotPassword(input: HelperInput): Promise<CodeSentState> {
    const data = readInput(input);
    const ctx: ErrorContext = { values: pickValues(data, ['identifier']), fields: FIELDS };
    const parsed = ForgotPasswordRequest.safeParse({
      audience,
      identifier: data.identifier,
      captchaToken: captchaToken(data),
    });
    if (!parsed.success) return invalid(parsed.error.issues, ctx);
    const identifier = parsed.data.identifier;
    const channel = channelFor(identifier);
    return attempt(ctx, async () => {
      await call('/auth/password/forgot', IgnoreBody, { method: 'POST', body: parsed.data });
      const display = maskTarget(identifier, channel);
      writePending(await deps.cookies(), {
        v: 1,
        target: identifier,
        display,
        channel,
        purpose: 'reset',
        sentAt: now(),
        next: loginPath,
      });
      return { status: 'sent', channel, target: display, expiresInSec: 300 } as const;
    });
  }

  /** Sets a new password with the emailed/texted code. The API ends every session. */
  async function resetPassword(input: HelperInput): Promise<DoneState> {
    const data = readInput(input);
    const jar = await deps.cookies();
    const state = readPending(jar);
    const ctx: ErrorContext = {
      fields: FIELDS,
      codeField: 'code',
      passwordField: 'newPassword',
    };
    const identifier = data.identifier ?? (state?.purpose === 'reset' ? state.target : undefined);
    if (!identifier) return makeError('PENDING_EXPIRED', ctx);
    const parsed = ResetPasswordRequest.safeParse({
      identifier,
      code: data.code?.replace(/\s+/g, ''),
      newPassword: data.newPassword,
    });
    if (!parsed.success) return invalid(parsed.error.issues, ctx);
    return attempt(ctx, async () => {
      await call('/auth/password/reset', IgnoreBody, { method: 'POST', body: parsed.data });
      clearSessionCookies(jar);
      return { status: 'ok' } as const;
    });
  }

  /** Ends this browser's session. Always clears the cookies, even if the API is unreachable. */
  async function logout(): Promise<DoneState> {
    const jar = await deps.cookies();
    const refreshToken = jar.get(names().refresh)?.value;
    if (refreshToken) {
      try {
        await call('/auth/logout', IgnoreBody, { method: 'POST', body: { refreshToken } });
      } catch (error) {
        if (!(error instanceof ApiRequestError)) throw error;
        // Local logout still happens; the server session expires on its own.
      }
    }
    clearSessionCookies(jar);
    return { status: 'ok' };
  }

  /** Ends every session of the user, this one included. */
  async function logoutAll(): Promise<DoneState> {
    const jar = await deps.cookies();
    try {
      await apiFetch('/auth/logout-all', IgnoreBody, { method: 'POST' });
    } catch (error) {
      if (!(error instanceof ApiRequestError && error.status === 401)) {
        return toAuthError(error, {
          messages: {
            NETWORK:
              'We couldn’t reach Her Beauty to sign out your other devices. Check your connection and try again.',
          },
        });
      }
    }
    clearSessionCookies(jar);
    return { status: 'ok' };
  }

  async function listSessions(): Promise<SessionInfo[]> {
    return apiFetch('/auth/sessions', SessionList);
  }

  /** Signs out one of the user's own devices. */
  async function revokeSession(input: HelperInput | string): Promise<DoneState> {
    const id = typeof input === 'string' ? input : readInput(input).id;
    const ctx: ErrorContext = {
      fields: FIELDS,
      messages: {
        NOT_FOUND: 'That device is already signed out. Refresh the page to see the latest list.',
      },
    };
    if (!id || id.length > 128) return invalid([{ path: ['id'] }], ctx);
    return attempt(ctx, async () => {
      await apiFetch(`/auth/sessions/${encodeURIComponent(id)}`, IgnoreBody, { method: 'DELETE' });
      return { status: 'ok' } as const;
    });
  }

  async function updateProfile(input: HelperInput): Promise<ProfileState> {
    const data = readInput(input);
    const ctx: ErrorContext = { values: pickValues(data, ['fullName']), fields: FIELDS };
    const parsed = UpdateMeRequest.safeParse({ fullName: data.fullName });
    if (!parsed.success) return invalid(parsed.error.issues, ctx);
    return attempt(ctx, async () => {
      const user = await apiFetch('/me', Me, { method: 'PATCH', body: parsed.data });
      return { status: 'ok', user } as const;
    });
  }

  return {
    config: { audience, sameSite, loginPath, homePath },
    getSession,
    requireSession,
    apiFetch,
    getPending,
    getMfaChallenge,
    adoptTokens,
    login,
    register,
    sendOtp,
    sendContactVerification,
    resendCode,
    verifyOtp,
    challenge2fa,
    setup2fa,
    enable2fa,
    disable2fa,
    forgotPassword,
    resetPassword,
    logout,
    logoutAll,
    listSessions,
    revokeSession,
    updateProfile,
  };
}

export type Auth = ReturnType<typeof createAuthCore>;
