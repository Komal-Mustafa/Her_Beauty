import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@hb/db';
import { CodeSent, LoginResult, Me, VerificationSent } from '@hb/types';
import type { MemoryMessageProvider } from '../src/messaging/message-provider';
import {
  Api,
  CAPTCHA_PASS,
  cleanup,
  claims,
  createTestApp,
  ErrorBody,
  expectOk,
  hasDb,
  nextIp,
  passwordLogin,
  registerAndVerify,
  STRONG_PASSWORD,
  uniqueEmail,
  uniquePhone,
} from './helpers';

/** Registration, verification, password + OTP login, lockout, CAPTCHA, reset (docs/b2-auth.md). */
describe.skipIf(!hasDb)('auth: register, login, codes', () => {
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

  describe('registration', () => {
    it('web: register -> verify code -> session, and the password works afterwards', async () => {
      const email = uniqueEmail('web');
      const res = await api
        .post('/auth/register', {
          audience: 'web',
          fullName: 'Ayesha Test',
          email,
          password: STRONG_PASSWORD,
        })
        .expect(202);
      expect(VerificationSent.parse(res.body)).toEqual({
        status: 'verification_sent',
        channel: 'email',
        target: `w•••@b2.test`,
      });
      // Registration is not complete until the address is verified.
      const early = await passwordLogin(api, email).expect(401);
      expect(ErrorBody.parse(early.body).error.code).toBe('INVALID_CREDENTIALS');

      const code = outbox.lastCode(email);
      expect(code).toMatch(/^\d{6}$/);
      const verified = await api
        .post('/auth/otp/verify', {
          audience: 'web',
          channel: 'email',
          target: email,
          purpose: 'verify',
          code,
        })
        .expect(200);
      const login = expectOk(verified.body);
      expect(login.user).toMatchObject({ email, emailVerified: true, role: 'customer' });
      expect(claims(login.tokens.accessToken)).toMatchObject({
        iss: 'herbeauty-api',
        aud: 'web',
        role: 'customer',
        mfa: false,
      });
      const me = await api.get('/me', login.tokens.accessToken).expect(200);
      expect(Me.parse(me.body).id).toBe(login.user.id);

      const again = await passwordLogin(api, email.toUpperCase()).expect(200);
      expect(expectOk(again.body).user.id).toBe(login.user.id);

      // The code was single use.
      await api
        .post('/auth/otp/verify', {
          audience: 'web',
          channel: 'email',
          target: email,
          purpose: 'verify',
          code,
        })
        .expect(400);
      const row = await db.user.findUniqueOrThrow({ where: { email } });
      expect(row.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    });

    it('seller: register creates a draft seller and the session carries the seller context', async () => {
      const email = uniqueEmail('seller');
      const phone = uniquePhone();
      const login = await registerAndVerify(api, outbox, {
        audience: 'seller',
        email,
        phone: phone.local,
        sellerType: 'manufacturer',
        storeName: 'Rose Lab Karachi',
      });
      expect(login.user.role).toBe('seller');
      expect(login.user.phone).toBe(phone.e164);
      expect(login.user.seller).toMatchObject({
        role: 'owner',
        type: 'manufacturer',
        status: 'draft',
        storeName: 'Rose Lab Karachi',
      });
      const token = claims(login.tokens.accessToken);
      expect(token).toMatchObject({
        aud: 'seller',
        sel: login.user.seller?.sellerId,
        srole: 'owner',
      });
      const profile = await api.get('/seller/me', login.tokens.accessToken).expect(200);
      expect(profile.body).toMatchObject({ status: 'draft', type: 'manufacturer', role: 'owner' });
      const audit = await db.auditLog.findFirst({
        where: { action: 'seller.application_started', actorId: login.user.id },
      });
      expect(audit).not.toBeNull();
    });

    it('answers the same 202 for a taken address and sends a notice instead of a code', async () => {
      const email = uniqueEmail('taken');
      const body = { audience: 'web', fullName: 'First Owner', email, password: STRONG_PASSWORD };
      const first = await api.post('/auth/register', body).expect(202);
      const second = await api
        .post('/auth/register', {
          ...body,
          fullName: 'Someone Else',
          password: 'Another-Long-Pass-99',
        })
        .expect(202);
      expect(second.body).toEqual(first.body);
      const messages = outbox.to(email);
      expect(messages).toHaveLength(2);
      expect(messages[1]?.subject).toMatch(/tried to sign up/);
      expect(messages[1]?.text).not.toMatch(/\d{6}/);
      expect(await db.user.count({ where: { email } })).toBe(1);
    });

    it('rejects weak passwords, bad phone numbers and unknown fields', async () => {
      const weak = await api
        .post('/auth/register', {
          audience: 'web',
          fullName: 'Weak',
          email: uniqueEmail(),
          password: 'Password123',
        })
        .expect(400);
      expect(ErrorBody.parse(weak.body).error.code).toBe('WEAK_PASSWORD');

      const phone = await api
        .post('/auth/register', {
          audience: 'web',
          fullName: 'Bad Phone',
          phone: '+1 415 555 0100',
          password: STRONG_PASSWORD,
        })
        .expect(400);
      expect(ErrorBody.parse(phone.body).error.code).toBe('VALIDATION_FAILED');

      const extra = await api
        .post('/auth/register', {
          audience: 'web',
          fullName: 'Sneaky',
          email: uniqueEmail(),
          password: STRONG_PASSWORD,
          role: 'admin',
        })
        .expect(400);
      expect(ErrorBody.parse(extra.body).error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('password login', () => {
    it('wrong password, unknown account and unverified account give the same 401 body', async () => {
      const email = uniqueEmail('same401');
      await registerAndVerify(api, outbox, { audience: 'web', email });
      const unverified = uniqueEmail('unverified');
      await api
        .post('/auth/register', {
          audience: 'web',
          fullName: 'Not Verified',
          email: unverified,
          password: STRONG_PASSWORD,
        })
        .expect(202);

      const ip = nextIp();
      const wrong = await passwordLogin(api, email, 'web', 'Wrong-Password-123', { ip }).expect(
        401,
      );
      const unknown = await passwordLogin(api, uniqueEmail('nobody'), 'web', STRONG_PASSWORD, {
        ip,
      }).expect(401);
      const notYet = await passwordLogin(api, unverified, 'web', STRONG_PASSWORD, { ip }).expect(
        401,
      );
      expect(ErrorBody.parse(wrong.body).error.code).toBe('INVALID_CREDENTIALS');
      expect(unknown.body).toEqual(wrong.body);
      expect(notYet.body).toEqual(wrong.body);

      const ok = await passwordLogin(api, email, 'web', STRONG_PASSWORD, { ip }).expect(200);
      expect(LoginResult.parse(ok.body).status).toBe('ok');
    });

    it('locks after 5 failures; a locked account gets the generic 401 even with the right password', async () => {
      const email = uniqueEmail('lock');
      await registerAndVerify(api, outbox, { audience: 'web', email });
      for (let i = 1; i <= 5; i++) {
        await passwordLogin(api, email, 'web', `Wrong-Password-${i}`).expect(401);
      }
      const user = await db.user.findUniqueOrThrow({ where: { email } });
      expect(user.failedLogins).toBe(5);
      expect(user.lockedUntil?.getTime()).toBeGreaterThan(Date.now() + 50_000);
      expect(user.lockedUntil?.getTime()).toBeLessThanOrEqual(Date.now() + 60_000);

      const ip = nextIp();
      const locked = await passwordLogin(api, email, 'web', STRONG_PASSWORD, { ip }).expect(401);
      const unknown = await passwordLogin(api, uniqueEmail('nobody'), 'web', STRONG_PASSWORD, {
        ip,
      }).expect(401);
      expect(locked.body).toEqual(unknown.body);

      // One notice per lock, one audit row, and failures during the lock are not counted.
      expect(outbox.to(email).filter((m) => /locked/.test(m.subject ?? ''))).toHaveLength(1);
      expect(await db.auditLog.count({ where: { action: 'auth.locked', actorId: user.id } })).toBe(
        1,
      );
      const during = await db.user.findUniqueOrThrow({ where: { email } });
      expect(during.failedLogins).toBe(5);

      // Lock over: the 6th failure locks for 2 minutes (exponential back-off).
      await db.user.update({ where: { email }, data: { lockedUntil: new Date(Date.now() - 1) } });
      await passwordLogin(api, email, 'web', 'Wrong-Password-6').expect(401);
      const second = await db.user.findUniqueOrThrow({ where: { email } });
      expect(second.lockedUntil?.getTime()).toBeGreaterThan(Date.now() + 110_000);

      // After the lock, the right password works and resets the counter.
      await db.user.update({ where: { email }, data: { lockedUntil: new Date(Date.now() - 1) } });
      await passwordLogin(api, email).expect(200);
      const reset = await db.user.findUniqueOrThrow({ where: { email } });
      expect(reset.failedLogins).toBe(0);
      expect(reset.lockedUntil).toBeNull();
    });

    it('parallel guesses from many IPs get 5 checks per lock, not one per request in flight', async () => {
      const email = uniqueEmail('burst');
      await registerAndVerify(api, outbox, { audience: 'web', email });
      const burst = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          passwordLogin(api, email, 'web', `Wrong-Password-${i}`),
        ),
      );
      expect(burst.every((r) => r.status === 401)).toBe(true);
      const user = await db.user.findUniqueOrThrow({ where: { email } });
      expect(user.failedLogins).toBe(5);
      expect(user.lockedUntil?.getTime()).toBeGreaterThan(Date.now() + 50_000);
      expect(outbox.to(email).filter((m) => /locked/.test(m.subject ?? ''))).toHaveLength(1);
      expect(await db.auditLog.count({ where: { action: 'auth.locked', actorId: user.id } })).toBe(
        1,
      );
      // Locked: even the right password is refused, and nothing more is counted.
      await passwordLogin(api, email).expect(401);
      expect((await db.user.findUniqueOrThrow({ where: { email } })).failedLogins).toBe(5);
    });

    it('a right password in a burst does not keep the lock its own check reserved', async () => {
      const email = uniqueEmail('burstok');
      await registerAndVerify(api, outbox, { audience: 'web', email });
      await db.user.update({ where: { email }, data: { failedLogins: 4 } });
      // The right password takes the 5th slot (which locks until it is checked), then gives it back.
      await passwordLogin(api, email).expect(200);
      const after = await db.user.findUniqueOrThrow({ where: { email } });
      expect(after.failedLogins).toBe(0);
      expect(after.lockedUntil).toBeNull();
    });

    it('asks an IP for a CAPTCHA after 5 failed logins (flag by IP, not by account)', async () => {
      const email = uniqueEmail('captcha');
      await registerAndVerify(api, outbox, { audience: 'web', email });
      const ip = nextIp();
      for (let i = 1; i <= 4; i++) {
        const res = await passwordLogin(api, uniqueEmail('ghost'), 'web', STRONG_PASSWORD, {
          ip,
        }).expect(401);
        expect(ErrorBody.parse(res.body).error.details).toEqual({});
      }
      const fifth = await passwordLogin(api, uniqueEmail('ghost'), 'web', STRONG_PASSWORD, {
        ip,
      }).expect(401);
      expect(ErrorBody.parse(fifth.body).error.details).toEqual({ captchaRequired: true });

      // Right credentials without / with a bad token are refused with the same flag.
      const missing = await passwordLogin(api, email, 'web', STRONG_PASSWORD, { ip }).expect(401);
      expect(ErrorBody.parse(missing.body).error).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        details: { captchaRequired: true },
      });
      await api
        .post(
          '/auth/login',
          { audience: 'web', identifier: email, password: STRONG_PASSWORD, captchaToken: 'bad' },
          { ip },
        )
        .expect(401);
      const solved = await api
        .post(
          '/auth/login',
          {
            audience: 'web',
            identifier: email,
            password: STRONG_PASSWORD,
            captchaToken: CAPTCHA_PASS,
          },
          { ip },
        )
        .expect(200);
      expect(LoginResult.parse(solved.body).status).toBe('ok');
      // Another IP is not affected.
      await passwordLogin(api, email).expect(200);
      // The account itself was never failed: the failures were unknown accounts.
      expect((await db.user.findUniqueOrThrow({ where: { email } })).failedLogins).toBe(0);
    });

    it('does not let customers into the admin app', async () => {
      const email = uniqueEmail('notadmin');
      await registerAndVerify(api, outbox, { audience: 'web', email });
      const res = await passwordLogin(api, email, 'admin').expect(401);
      expect(ErrorBody.parse(res.body).error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('one-time codes', () => {
    it('logs in with a phone code; a new number needs a name first (code kept for the retry)', async () => {
      const phone = uniquePhone();
      const send = { audience: 'web', channel: 'sms', target: phone.local, purpose: 'login' };
      const sent = await api.post('/auth/otp/send', send).expect(202);
      expect(CodeSent.parse(sent.body)).toEqual({ status: 'sent', expiresInSec: 300 });
      const code = outbox.lastCode(phone.e164);
      expect(code).toMatch(/^\d{6}$/);

      // A wrong code for an unknown number is INVALID_CODE, never PROFILE_REQUIRED.
      const wrongCode = code === '000000' ? '111111' : '000000';
      const wrong = await api.post('/auth/otp/verify', { ...send, code: wrongCode }).expect(400);
      expect(ErrorBody.parse(wrong.body).error.code).toBe('INVALID_CODE');

      const needName = await api.post('/auth/otp/verify', { ...send, code }).expect(422);
      expect(ErrorBody.parse(needName.body).error.code).toBe('PROFILE_REQUIRED');
      expect(await db.user.count({ where: { phone: phone.e164 } })).toBe(0);

      const done = await api
        .post('/auth/otp/verify', { ...send, code, fullName: 'Sana Phone' })
        .expect(200);
      const login = expectOk(done.body);
      expect(login.user).toMatchObject({
        phone: phone.e164,
        phoneVerified: true,
        role: 'customer',
        hasPassword: false,
        fullName: 'Sana Phone',
      });
      // Single use.
      await api.post('/auth/otp/verify', { ...send, code, fullName: 'Sana Phone' }).expect(400);

      // An existing account logs straight in with a new code.
      await api.post('/auth/otp/send', send).expect(202);
      const next = await api
        .post('/auth/otp/verify', { ...send, code: outbox.lastCode(phone.e164) })
        .expect(200);
      expect(expectOk(next.body).user.id).toBe(login.user.id);
    });

    it('a code login into a never-verified account drops the password nobody proved (pre-hijacking)', async () => {
      const email = uniqueEmail('prehijack');
      // Someone registers the victim's address with their own password and never verifies.
      await api
        .post('/auth/register', {
          audience: 'web',
          fullName: 'Squatter',
          email,
          password: 'Squatter-Password-2026',
        })
        .expect(202);
      // The real owner signs in with a code sent to their inbox.
      const send = { audience: 'web', channel: 'email', target: email, purpose: 'login' };
      await api.post('/auth/otp/send', send).expect(202);
      const res = await api
        .post('/auth/otp/verify', { ...send, code: outbox.lastCode(email) })
        .expect(200);
      expect(expectOk(res.body).user).toMatchObject({ emailVerified: true, hasPassword: false });
      // The squatter's password no longer opens the account.
      await passwordLogin(api, email, 'web', 'Squatter-Password-2026').expect(401);
    });

    it('code login is for the shop only', async () => {
      const res = await api
        .post('/auth/otp/send', {
          audience: 'seller',
          channel: 'email',
          target: uniqueEmail(),
          purpose: 'login',
        })
        .expect(403);
      expect(ErrorBody.parse(res.body).error.code).toBe('FORBIDDEN');
    });

    it('limits sends to 3 per 15 minutes per target', async () => {
      const target = uniqueEmail('bomb');
      const send = { audience: 'web', channel: 'email', target, purpose: 'login' };
      for (let i = 0; i < 3; i++) await api.post('/auth/otp/send', send).expect(202);
      const limited = await api.post('/auth/otp/send', send).expect(429);
      const body = ErrorBody.parse(limited.body);
      expect(body.error.code).toBe('RATE_LIMITED');
      expect(body.error.details.retryAfterSec).toBeGreaterThan(800);
      expect(body.error.details.retryAfterSec).toBeLessThanOrEqual(900);
      expect(outbox.to(target)).toHaveLength(3);
    });

    it('limits sends to 3 per 15 minutes per client IP, and records the IP', async () => {
      const ip = nextIp();
      for (let i = 0; i < 3; i++) {
        await api
          .post(
            '/auth/otp/send',
            { audience: 'web', channel: 'email', target: uniqueEmail('ip'), purpose: 'login' },
            { ip },
          )
          .expect(202);
      }
      const limited = await api
        .post(
          '/auth/otp/send',
          { audience: 'web', channel: 'email', target: uniqueEmail('ip'), purpose: 'login' },
          { ip },
        )
        .expect(429);
      expect(ErrorBody.parse(limited.body).error.code).toBe('RATE_LIMITED');
      expect(await db.otpCode.count({ where: { requestIp: ip } })).toBe(3);
      // Password reset requests share the same limits.
      await api
        .post('/auth/password/forgot', { audience: 'web', identifier: uniqueEmail() }, { ip })
        .expect(429);
    });

    it('kills a code after 3 wrong tries', async () => {
      const phone = uniquePhone();
      const send = { audience: 'web', channel: 'sms', target: phone.e164, purpose: 'login' };
      await api.post('/auth/otp/send', send).expect(202);
      const code = outbox.lastCode(phone.e164) ?? '';
      const wrong = code === '123456' ? '654321' : '123456';
      for (let i = 0; i < 3; i++) {
        await api.post('/auth/otp/verify', { ...send, code: wrong }).expect(400);
      }
      const dead = await api
        .post('/auth/otp/verify', { ...send, code, fullName: 'Too Late' })
        .expect(400);
      expect(ErrorBody.parse(dead.body).error.code).toBe('INVALID_CODE');
      expect(await db.user.count({ where: { phone: phone.e164 } })).toBe(0);
    });

    it('only the newest code works', async () => {
      const target = uniqueEmail('newest');
      const send = { audience: 'web', channel: 'email', target, purpose: 'login' };
      await api.post('/auth/otp/send', send).expect(202);
      const older = outbox.lastCode(target) ?? '';
      await api.post('/auth/otp/send', send).expect(202);
      const newest = outbox.lastCode(target) ?? '';
      if (older !== newest)
        await api.post('/auth/otp/verify', { ...send, code: older }).expect(400);
      // Right code, no account yet: PROFILE_REQUIRED (the code is still usable).
      await api.post('/auth/otp/verify', { ...send, code: newest }).expect(422);
    });
  });

  describe('password reset', () => {
    it('sets a new password, clears the lock and revokes every session', async () => {
      const email = uniqueEmail('reset');
      const first = await registerAndVerify(api, outbox, { audience: 'web', email });
      const second = expectOk((await passwordLogin(api, email).expect(200)).body);
      await db.user.update({
        where: { email },
        data: { failedLogins: 7, lockedUntil: new Date(Date.now() + 3_600_000) },
      });

      const sent = await api
        .post('/auth/password/forgot', { audience: 'web', identifier: email })
        .expect(202);
      expect(CodeSent.parse(sent.body).status).toBe('sent');
      const code = outbox.lastCode(email);
      const newPassword = 'Silk-Lantern-Marigold-88';
      const weak = await api
        .post('/auth/password/reset', { identifier: email, code, newPassword: 'password1' })
        .expect(400);
      expect(ErrorBody.parse(weak.body).error.code).toBe('WEAK_PASSWORD');
      await api.post('/auth/password/reset', { identifier: email, code, newPassword }).expect(204);

      for (const tokens of [first.tokens, second.tokens]) {
        const res = await api.get('/me', tokens.accessToken).expect(401);
        expect(ErrorBody.parse(res.body).error.code).toBe('SESSION_REVOKED');
      }
      await passwordLogin(api, email).expect(401);
      const after = await passwordLogin(api, email, 'web', newPassword).expect(200);
      expect(LoginResult.parse(after.body).status).toBe('ok');
      const audit = await db.auditLog.findFirst({
        where: { action: 'auth.password_reset', actorId: first.user.id },
      });
      expect(audit?.meta).toMatchObject({ revokedSessions: 2 });
      // The code was single use.
      await api
        .post('/auth/password/reset', {
          identifier: email,
          code,
          newPassword: 'Another-Fresh-Pass-1',
        })
        .expect(400);
    });

    it('answers forgot-password the same way for unknown accounts and sends nothing', async () => {
      const email = uniqueEmail('ghost');
      const res = await api
        .post('/auth/password/forgot', { audience: 'web', identifier: email })
        .expect(202);
      expect(res.body).toEqual({ status: 'sent', expiresInSec: 300 });
      expect(outbox.to(email)).toHaveLength(0);
    });
  });

  describe('profile', () => {
    it('PATCH /me changes the name only; any other field is a 400', async () => {
      const login = await registerAndVerify(api, outbox, { audience: 'web', email: uniqueEmail() });
      const token = login.tokens.accessToken;
      const bad = await api
        .patch('/me', { fullName: 'New Name', role: 'admin' }, token)
        .expect(400);
      expect(ErrorBody.parse(bad.body).error.code).toBe('VALIDATION_FAILED');
      const ok = await api.patch('/me', { fullName: '  Ayesha Renamed ' }, token).expect(200);
      expect(Me.parse(ok.body)).toMatchObject({ fullName: 'Ayesha Renamed', role: 'customer' });
      await api.patch('/me', { fullName: 'No Token' }).expect(401);
    });
  });
});
