import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, uuidv7 } from '@hb/db';
import { AdminOverview, LoginResult, TwoFactorEnabled, TwoFactorSetup } from '@hb/types';
import { PasswordService } from '../src/auth/password.service';
import { SessionService } from '../src/auth/session.service';
import { TokenService } from '../src/auth/token.service';
import type { MemoryMessageProvider } from '../src/messaging/message-provider';
import {
  Api,
  cleanup,
  claims,
  createTestApp,
  ErrorBody,
  expectOk,
  hasDb,
  passwordLogin,
  registerAndVerify,
  STRONG_PASSWORD,
  totp,
  uniqueEmail,
} from './helpers';

/** TOTP 2FA, backup codes, admin enrolment and the admin API (docs/b2-auth.md §3–5). */
describe.skipIf(!hasDb)('auth: two-factor and admin access', () => {
  let app: INestApplication;
  let outbox: MemoryMessageProvider;
  let api: Api;
  const db = createPrismaClient();

  beforeAll(async () => {
    ({ app, outbox } = await createTestApp());
    api = new Api(app);
  });

  afterAll(async () => {
    await cleanup(db);
    await db.$disconnect();
    await app?.close();
  });

  const challenge = (challengeToken: string, code: string) =>
    api.post('/auth/2fa/challenge', { challengeToken, code });

  function challengeTokenOf(body: unknown, status: 'mfa_required' | 'mfa_setup_required') {
    const result = LoginResult.parse(body);
    if (result.status !== status) throw new Error(`expected ${status}, got ${result.status}`);
    expect(result.expiresInSec).toBe(300);
    return result.challengeToken;
  }

  async function createAdmin(role: 'admin' | 'support' = 'admin') {
    const email = uniqueEmail(role);
    const passwordHash = await app.get(PasswordService).hash(STRONG_PASSWORD);
    const user = await db.user.create({
      data: {
        id: uuidv7(),
        email,
        fullName: 'Test Admin',
        role,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    return { email, user };
  }

  it('web user: setup, enable, challenge with TOTP and backup codes; replays fail', async () => {
    const email = uniqueEmail('totp');
    const login = await registerAndVerify(api, outbox, { audience: 'web', email });
    const token = login.tokens.accessToken;

    const setup = TwoFactorSetup.parse(
      (await api.post('/auth/2fa/setup', {}, { token }).expect(200)).body,
    );
    expect(setup.otpauthUri).toContain('issuer=Her%20Beauty');
    const stored = await db.user.findUniqueOrThrow({ where: { email } });
    // Encrypted at rest: [version][IV][tag][ciphertext], never the base32 secret.
    expect(stored.twofaSecretEnc?.[0]).toBe(1);
    expect(Buffer.from(stored.twofaSecretEnc ?? []).toString()).not.toContain(setup.secret);

    const enableCode = totp(setup.secret);
    const wrongCode = enableCode === '000000' ? '111111' : '000000';
    await api.post('/auth/2fa/enable', { code: wrongCode }, { token }).expect(400);
    const enabled = TwoFactorEnabled.parse(
      (await api.post('/auth/2fa/enable', { code: enableCode }, { token }).expect(200)).body,
    );
    expect(enabled.backupCodes).toHaveLength(10);
    expect(
      enabled.backupCodes.every((c) => /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/.test(c)),
    ).toBe(true);
    expect(enabled.login).toBeUndefined();
    expect((await api.get('/me', token).expect(200)).body.twoFactorEnabled).toBe(true);
    // Never replaces an enabled secret.
    const again = await api.post('/auth/2fa/setup', {}, { token }).expect(409);
    expect(ErrorBody.parse(again.body).error.code).toBe('CONFLICT');

    // Password login now stops at the second factor.
    let ct = challengeTokenOf((await passwordLogin(api, email).expect(200)).body, 'mfa_required');
    // The challenge token is not an access token.
    const asBearer = await api.get('/me', ct).expect(401);
    expect(ErrorBody.parse(asBearer.body).error.code).toBe('UNAUTHENTICATED');
    // The code used to enable 2FA cannot be replayed.
    const replay = await challenge(ct, enableCode).expect(400);
    expect(ErrorBody.parse(replay.body).error.code).toBe('INVALID_CODE');
    const next = totp(setup.secret, 1);
    const ok = expectOk((await challenge(ct, next).expect(200)).body);
    expect(claims(ok.tokens.accessToken).mfa).toBe(true);
    // Same code again on a fresh login: replay.
    ct = challengeTokenOf((await passwordLogin(api, email).expect(200)).body, 'mfa_required');
    await challenge(ct, next).expect(400);

    // Backup codes: single use; lower case and no dash are fine.
    const [b0, b1] = enabled.backupCodes;
    await challenge(ct, b0 ?? '').expect(200);
    ct = challengeTokenOf((await passwordLogin(api, email).expect(200)).body, 'mfa_required');
    await challenge(ct, b0 ?? '').expect(400);
    await challenge(ct, (b1 ?? '').replace('-', '').toLowerCase()).expect(200);
    const hashes = await db.twofaBackupCode.findMany({ where: { userId: login.user.id } });
    expect(hashes.filter((h) => h.usedAt !== null)).toHaveLength(2);
    expect(hashes.some((h) => enabled.backupCodes.includes(h.codeHash))).toBe(false);

    // Disable needs the password and a code.
    const bearer = ok.tokens.accessToken;
    await api
      .post(
        '/auth/2fa/disable',
        { password: 'Wrong-Password-1', code: enabled.backupCodes[2] },
        {
          token: bearer,
        },
      )
      .expect(401);
    await api
      .post(
        '/auth/2fa/disable',
        { password: STRONG_PASSWORD, code: enabled.backupCodes[2] },
        {
          token: bearer,
        },
      )
      .expect(204);
    expect((await api.get('/me', bearer).expect(200)).body.twoFactorEnabled).toBe(false);
    expect(await db.twofaBackupCode.count({ where: { userId: login.user.id } })).toBe(0);
    const actions = await db.auditLog.findMany({
      where: { actorId: login.user.id, action: { startsWith: 'auth.2fa' } },
      select: { action: true },
    });
    expect(actions.map((a) => a.action).sort()).toEqual(['auth.2fa_disabled', 'auth.2fa_enabled']);
    // Back to a plain password login.
    expect(LoginResult.parse((await passwordLogin(api, email).expect(200)).body).status).toBe('ok');
  });

  it('a challenge token completes one sign-in only, even when two requests race', async () => {
    const email = uniqueEmail('once');
    const login = await registerAndVerify(api, outbox, { audience: 'web', email });
    const token = login.tokens.accessToken;
    const { secret } = TwoFactorSetup.parse(
      (await api.post('/auth/2fa/setup', {}, { token }).expect(200)).body,
    );
    const { backupCodes } = TwoFactorEnabled.parse(
      (await api.post('/auth/2fa/enable', { code: totp(secret) }, { token }).expect(200)).body,
    );
    const [b0, b1, b2, b3] = backupCodes;

    const ct = challengeTokenOf((await passwordLogin(api, email).expect(200)).body, 'mfa_required');
    expectOk((await challenge(ct, b0 ?? '').expect(200)).body);
    const again = await challenge(ct, b1 ?? '').expect(401);
    expect(ErrorBody.parse(again.body).error.code).toBe('UNAUTHENTICATED');
    // The refused attempt did not use up the backup code.
    const next = challengeTokenOf(
      (await passwordLogin(api, email).expect(200)).body,
      'mfa_required',
    );
    await challenge(next, b1 ?? '').expect(200);

    // Two parallel completions with one token and two valid codes: exactly one session.
    const racing = challengeTokenOf(
      (await passwordLogin(api, email).expect(200)).body,
      'mfa_required',
    );
    const before = await db.session.count({ where: { userId: login.user.id } });
    const results = await Promise.all([challenge(racing, b2 ?? ''), challenge(racing, b3 ?? '')]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    expect(await db.session.count({ where: { userId: login.user.id } })).toBe(before + 1);
  });

  it('wrong second factors count as failed logins and lock the account', async () => {
    const email = uniqueEmail('totplock');
    const login = await registerAndVerify(api, outbox, { audience: 'web', email });
    const token = login.tokens.accessToken;
    const { secret } = TwoFactorSetup.parse(
      (await api.post('/auth/2fa/setup', {}, { token }).expect(200)).body,
    );
    await api.post('/auth/2fa/enable', { code: totp(secret) }, { token }).expect(200);
    const ct = challengeTokenOf((await passwordLogin(api, email).expect(200)).body, 'mfa_required');
    for (let i = 0; i < 5; i++) await challenge(ct, 'AAAAA-AAAAA').expect(400);
    const locked = await challenge(ct, totp(secret, 1)).expect(401);
    expect(ErrorBody.parse(locked.body).error.code).toBe('INVALID_CREDENTIALS');
    expect((await db.user.findUniqueOrThrow({ where: { email } })).failedLogins).toBe(5);
  });

  it('admin: first login enrols 2FA, later logins need the code, and /admin/overview works', async () => {
    const { email, user } = await createAdmin();
    const setupCt = challengeTokenOf(
      (await passwordLogin(api, email, 'admin').expect(200)).body,
      'mfa_setup_required',
    );
    // A setup challenge token is not an access token either, nor an mfa challenge token.
    await api.get('/me', setupCt).expect(401);
    await challenge(setupCt, '123456').expect(401);

    const setup = TwoFactorSetup.parse(
      (await api.post('/auth/2fa/setup', { challengeToken: setupCt }).expect(200)).body,
    );
    const enabled = TwoFactorEnabled.parse(
      (
        await api
          .post('/auth/2fa/enable', { challengeToken: setupCt, code: totp(setup.secret) })
          .expect(200)
      ).body,
    );
    expect(enabled.backupCodes).toHaveLength(10);
    const first = expectOk(enabled.login);
    // The setup challenge token finished a sign-in, so it is spent.
    const spent = await api.post('/auth/2fa/setup', { challengeToken: setupCt }).expect(401);
    expect(ErrorBody.parse(spent.body).error.code).toBe('UNAUTHENTICATED');
    expect(claims(first.tokens.accessToken)).toMatchObject({
      aud: 'admin',
      role: 'admin',
      mfa: true,
    });
    // Admin refresh lifetime is 12 hours.
    const hours = (Date.parse(first.tokens.refreshExpiresAt) - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(11.9);
    expect(hours).toBeLessThanOrEqual(12);

    const overview = await api.get('/admin/overview', first.tokens.accessToken).expect(200);
    const counts = AdminOverview.parse(overview.body);
    expect(counts.sellers.approved).toBeGreaterThan(0);
    expect(counts.liveProducts).toBeGreaterThan(0);

    // Next login: TOTP challenge.
    const ct = challengeTokenOf(
      (await passwordLogin(api, email, 'admin').expect(200)).body,
      'mfa_required',
    );
    const second = expectOk((await challenge(ct, totp(setup.secret, 1)).expect(200)).body);
    await api.get('/admin/overview', second.tokens.accessToken).expect(200);
    // Refresh keeps mfa: true.
    const refreshed = await api
      .post('/auth/refresh', { refreshToken: second.tokens.refreshToken })
      .expect(200);
    expect(claims(refreshed.body.accessToken).mfa).toBe(true);
    await api.get('/admin/overview', refreshed.body.accessToken).expect(200);

    // The rotated-away session's access token is dead at once.
    await api.get('/admin/overview', second.tokens.accessToken).expect(401);

    // Admins cannot switch 2FA off.
    const off = await api
      .post(
        '/auth/2fa/disable',
        { password: STRONG_PASSWORD, code: enabled.backupCodes[0] },
        {
          token: refreshed.body.accessToken,
        },
      )
      .expect(403);
    expect(ErrorBody.parse(off.body).error.code).toBe('FORBIDDEN');

    const audits = await db.auditLog.findMany({ where: { actorId: user.id } });
    expect(audits.filter((a) => a.action === 'auth.login')).toHaveLength(2);
    expect(audits.some((a) => a.action === 'auth.2fa_enabled')).toBe(true);
    await passwordLogin(api, email, 'admin', 'Wrong-Password-1').expect(401);
    expect(
      await db.auditLog.count({ where: { actorId: user.id, action: 'auth.login_failed' } }),
    ).toBe(1);
  });

  it('/admin/overview rejects other apps, non-admin roles and sessions without 2FA', async () => {
    const customer = await registerAndVerify(api, outbox, {
      audience: 'web',
      email: uniqueEmail(),
    });
    const web = await api.get('/admin/overview', customer.tokens.accessToken).expect(403);
    expect(ErrorBody.parse(web.body).error.code).toBe('FORBIDDEN');

    const sellerLogin = expectOk(
      (await passwordLogin(api, customer.user.email ?? '', 'seller').expect(200)).body,
    );
    await api.get('/admin/overview', sellerLogin.tokens.accessToken).expect(403);

    // Tokens the login flow would never issue, minted directly: admin app + customer role,
    // and admin app + admin role without 2FA.
    const tokens = app.get(TokenService);
    const sessions = app.get(SessionService);
    const client = { ip: '10.0.0.1', userAgent: 'test' };
    const custSession = await sessions.create({
      userId: customer.user.id,
      audience: 'admin',
      mfa: true,
      client,
    });
    const custToken = await tokens.signAccess({
      userId: customer.user.id,
      sessionId: custSession.session.id,
      audience: 'admin',
      role: 'customer',
      mfa: true,
    });
    const role = await api.get('/admin/overview', custToken.token).expect(403);
    expect(ErrorBody.parse(role.body).error.code).toBe('FORBIDDEN');

    const { user: admin } = await createAdmin('support');
    const adminSession = await sessions.create({
      userId: admin.id,
      audience: 'admin',
      mfa: false,
      client,
    });
    const noMfa = await tokens.signAccess({
      userId: admin.id,
      sessionId: adminSession.session.id,
      audience: 'admin',
      role: 'support',
      mfa: false,
    });
    const mfa = await api.get('/admin/overview', noMfa.token).expect(403);
    expect(ErrorBody.parse(mfa.body).error.code).toBe('MFA_REQUIRED');

    // A token whose audience does not match its session is refused outright.
    const mismatched = await tokens.signAccess({
      userId: customer.user.id,
      sessionId: String(claims(customer.tokens.accessToken).sid),
      audience: 'admin',
      role: 'admin',
      mfa: true,
    });
    await api.get('/admin/overview', mismatched.token).expect(401);
    await api.get('/admin/overview').expect(401);
  });
});
