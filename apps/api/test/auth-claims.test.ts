import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, uuidv7 } from '@hb/db';
import { Me } from '@hb/types';
import type { MemoryMessageProvider } from '../src/messaging/message-provider';
import {
  Api,
  createTestApp,
  cleanup,
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

const SQUATTER_PASSWORD = 'Squatter-Password-2026';
const OWNER_PASSWORD = 'Owner-Password-Tulip-77';

/**
 * Who owns an account (docs/b2-auth.md §3): registration pre-hijacking, a second identifier that
 * nobody verified, and what /auth/register reveals to the requester.
 */
describe.skipIf(!hasDb)('auth: account claims', () => {
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

  const verifyBody = (audience: string, channel: 'email' | 'sms', target: string) => ({
    audience,
    channel,
    target,
    purpose: 'verify',
  });

  /**
   * Ask for a code and use the one delivered (none delivered ⇒ a wrong one); the verify answer
   * must have `status`.
   */
  async function sendAndVerify(
    body: ReturnType<typeof verifyBody>,
    deliveredTo: string,
    status: number,
  ) {
    const before = outbox.to(deliveredTo).length;
    await api.post('/auth/otp/send', body).expect(202);
    const delivered = outbox.to(deliveredTo).length > before;
    const code = (delivered && outbox.lastCode(deliveredTo)) || '000000';
    const res = await api.post('/auth/otp/verify', { ...body, code }).expect(status);
    return { delivered, body: res.body as unknown };
  }

  /** An account holding `phone` as a verified identifier (created by a phone code login). */
  async function phoneAccount(phone: { local: string; e164: string }) {
    const send = { audience: 'web', channel: 'sms', target: phone.local, purpose: 'login' };
    await api.post('/auth/otp/send', send).expect(202);
    const res = await api
      .post('/auth/otp/verify', { ...send, code: outbox.lastCode(phone.e164), fullName: 'Holder' })
      .expect(200);
    return expectOk(res.body);
  }

  describe('registration pre-hijacking', () => {
    it('web: after a disputed sign-up, verifying drops the first sign-up’s password and number', async () => {
      const email = uniqueEmail('victim');
      const squatterPhone = uniquePhone();
      // Someone signs up with the victim's address and their own password and number.
      await api
        .post('/auth/register', {
          audience: 'web',
          fullName: 'Squatter',
          email,
          phone: squatterPhone.local,
          password: SQUATTER_PASSWORD,
        })
        .expect(202);
      // The victim signs up later, gets the notice, and presses "Resend" on /verify.
      await api
        .post('/auth/register', {
          audience: 'web',
          fullName: 'Real Owner',
          email,
          password: OWNER_PASSWORD,
        })
        .expect(202);
      expect(outbox.last(email)?.subject).toMatch(/tried to sign up/);
      const { delivered, body } = await sendAndVerify(
        verifyBody('web', 'email', email),
        email,
        200,
      );
      expect(delivered).toBe(true);
      const login = expectOk(body);
      expect(login.user).toMatchObject({ emailVerified: true, hasPassword: false, phone: null });

      // The squatter's password opens nothing; the victim sets theirs with "forgot password".
      const squatter = await passwordLogin(api, email, 'web', SQUATTER_PASSWORD).expect(401);
      expect(ErrorBody.parse(squatter.body).error.code).toBe('INVALID_CREDENTIALS');
      await api.get('/me', login.tokens.accessToken).expect(200);
    });

    it('seller: the same dispute leaves the squatter no seller login', async () => {
      const email = uniqueEmail('sellervictim');
      const signUp = (fullName: string, password: string) => ({
        audience: 'seller',
        sellerType: 'vendor',
        storeName: 'Borrowed Name Beauty',
        fullName,
        email,
        phone: uniquePhone().local,
        password,
      });
      await api.post('/auth/register', signUp('Squatter', SQUATTER_PASSWORD)).expect(202);
      await api.post('/auth/register', signUp('Real Owner', OWNER_PASSWORD)).expect(202);
      const { body } = await sendAndVerify(verifyBody('seller', 'email', email), email, 200);
      const login = expectOk(body);
      expect(login.user).toMatchObject({ hasPassword: false, phone: null, role: 'seller' });
      await passwordLogin(api, email, 'seller', SQUATTER_PASSWORD).expect(401);
    });

    it('a verify code sent again (not by the sign-up itself) never keeps the sign-up password', async () => {
      const email = uniqueEmail('resent');
      const phone = uniquePhone();
      await api
        .post('/auth/register', {
          audience: 'web',
          fullName: 'Squatter',
          email,
          phone: phone.local,
          password: SQUATTER_PASSWORD,
        })
        .expect(202);
      // Anyone can ask for a new sign-up code for an address (seller "send a new code" form).
      const { body } = await sendAndVerify(verifyBody('web', 'email', email), email, 200);
      const login = expectOk(body);
      // Signed in without the sign-up password; the number is kept but is not an identifier.
      expect(login.user).toMatchObject({
        emailVerified: true,
        hasPassword: false,
        phone: phone.e164,
        phoneVerified: false,
      });
      await passwordLogin(api, email, 'web', SQUATTER_PASSWORD).expect(401);
    });

    it('the code sent by the sign-up itself keeps its password and number', async () => {
      const email = uniqueEmail('honest');
      const phone = uniquePhone();
      const login = await registerAndVerify(api, outbox, {
        audience: 'seller',
        email,
        phone: phone.local,
      });
      expect(login.user).toMatchObject({ hasPassword: true, phone: phone.e164 });
      await passwordLogin(api, email, 'seller').expect(200);
    });
  });

  describe('a second identifier nobody verified', () => {
    it('someone else’s number given at sign-up is not a credential; its owner gets their own account', async () => {
      const victimPhone = uniquePhone();
      const attackerEmail = uniqueEmail('trojan');
      const attacker = await registerAndVerify(api, outbox, {
        audience: 'web',
        email: attackerEmail,
        phone: victimPhone.local,
      });
      expect(attacker.user).toMatchObject({ phone: victimPhone.e164, phoneVerified: false });

      // The number cannot be verified into the account or used for a reset.
      const verify = await sendAndVerify(
        verifyBody('web', 'sms', victimPhone.local),
        victimPhone.e164,
        400,
      );
      expect(verify.delivered).toBe(false);
      expect(ErrorBody.parse(verify.body).error.code).toBe('INVALID_CODE');
      await api
        .post('/auth/password/forgot', { audience: 'web', identifier: victimPhone.local })
        .expect(202);
      expect(outbox.to(victimPhone.e164)).toHaveLength(0);

      // The number's owner signs in with a code: a new account of their own, not the attacker's.
      const send = { audience: 'web', channel: 'sms', target: victimPhone.local, purpose: 'login' };
      await api.post('/auth/otp/send', send).expect(202);
      const code = outbox.lastCode(victimPhone.e164);
      const needName = await api.post('/auth/otp/verify', { ...send, code }).expect(422);
      expect(ErrorBody.parse(needName.body).error.code).toBe('PROFILE_REQUIRED');
      const own = expectOk(
        (
          await api
            .post('/auth/otp/verify', { ...send, code, fullName: 'Number Owner' })
            .expect(200)
        ).body,
      );
      expect(own.user.id).not.toBe(attacker.user.id);
      expect(own.user).toMatchObject({ phone: victimPhone.e164, phoneVerified: true });
      // The attacker's account is untouched and still has no hold on the number.
      const attackerRow = await db.user.findUniqueOrThrow({ where: { id: attacker.user.id } });
      expect(attackerRow).toMatchObject({ phone: null, pendingPhone: victimPhone.e164 });
    });

    it('seller: a mistyped number never signs its holder into the store', async () => {
      const typo = uniquePhone();
      const seller = await registerAndVerify(api, outbox, {
        audience: 'seller',
        email: uniqueEmail('typo'),
        phone: typo.local,
      });
      const { delivered } = await sendAndVerify(
        verifyBody('seller', 'sms', typo.local),
        typo.e164,
        400,
      );
      expect(delivered).toBe(false);
      expect(await db.session.count({ where: { userId: seller.user.id } })).toBe(1);
    });

    it('claiming a squatted sign-up through "forgot password" drops the squatter’s number', async () => {
      const email = uniqueEmail('claim');
      const attackerPhone = uniquePhone();
      await api
        .post('/auth/register', {
          audience: 'web',
          fullName: 'Squatter',
          email,
          phone: attackerPhone.local,
          password: SQUATTER_PASSWORD,
        })
        .expect(202);
      await api.post('/auth/password/forgot', { audience: 'web', identifier: email }).expect(202);
      await api
        .post('/auth/password/reset', {
          identifier: email,
          code: outbox.lastCode(email),
          newPassword: OWNER_PASSWORD,
        })
        .expect(204);
      const owner = expectOk(
        (await passwordLogin(api, email, 'web', OWNER_PASSWORD).expect(200)).body,
      );
      expect(Me.parse(owner.user)).toMatchObject({ emailVerified: true, phone: null });
      await passwordLogin(api, email, 'web', SQUATTER_PASSWORD).expect(401);

      // The squatter's number leads nowhere near the owner's account.
      const verify = await sendAndVerify(
        verifyBody('web', 'sms', attackerPhone.local),
        attackerPhone.e164,
        400,
      );
      expect(verify.delivered).toBe(false);
      const send = {
        audience: 'web',
        channel: 'sms',
        target: attackerPhone.local,
        purpose: 'login',
      };
      await api.post('/auth/otp/send', send).expect(202);
      await api
        .post('/auth/otp/verify', { ...send, code: outbox.lastCode(attackerPhone.e164) })
        .expect(422);
    });

    it('an unverified number left on an account from before pending_phone is not a credential', async () => {
      const phone = uniquePhone();
      const user = await db.user.create({
        data: {
          id: uuidv7(),
          email: uniqueEmail('legacy'),
          phone: phone.e164,
          fullName: 'Legacy Stray',
          emailVerifiedAt: new Date(),
        },
      });
      for (const purpose of ['verify', 'login']) {
        await api
          .post('/auth/otp/send', { audience: 'web', channel: 'sms', target: phone.local, purpose })
          .expect(202);
      }
      await api
        .post('/auth/password/forgot', { audience: 'web', identifier: phone.local })
        .expect(202);
      expect(outbox.to(phone.e164)).toHaveLength(0);
      expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    });
  });

  describe('what /auth/register reveals', () => {
    it('the requester’s own inbox gets a code whether or not their second identifier is taken', async () => {
      const taken = uniquePhone();
      await phoneAccount(taken);
      const free = uniquePhone();
      for (const phone of [taken, free]) {
        const email = uniqueEmail('probe');
        const before = outbox.to(phone.e164).length;
        const res = await api
          .post('/auth/register', {
            audience: 'seller',
            sellerType: 'vendor',
            storeName: 'Probe Shop',
            fullName: 'Probe',
            email,
            phone: phone.local,
            password: STRONG_PASSWORD,
          })
          .expect(202);
        expect(res.body).toMatchObject({ status: 'verification_sent', channel: 'email' });
        expect(outbox.lastCode(email)).toMatch(/^\d{6}$/);
        expect(outbox.to(phone.e164)).toHaveLength(before);
      }
    });

    it('records exactly one send per request, so a taken address never hits the limit first', async () => {
      const takenEmail = uniqueEmail('limit');
      const takenPhone = uniquePhone();
      await registerAndVerify(api, outbox, { audience: 'web', email: takenEmail });
      await phoneAccount(takenPhone);
      const probes = [
        { email: takenEmail, phone: takenPhone.local },
        { email: uniqueEmail('limitfree'), phone: uniquePhone().local },
      ];
      for (const probe of probes) {
        // The IP is one send short of its limit (3 per 15 minutes).
        const ip = nextIp();
        for (let i = 0; i < 2; i++) {
          await api
            .post(
              '/auth/otp/send',
              { audience: 'web', channel: 'email', target: uniqueEmail('prime'), purpose: 'login' },
              { ip },
            )
            .expect(202);
        }
        const res = await api
          .post(
            '/auth/register',
            { audience: 'web', fullName: 'Probe', password: STRONG_PASSWORD, ...probe },
            { ip },
          )
          .expect(202);
        expect(res.body).toMatchObject({ status: 'verification_sent' });
        expect(await db.otpCode.count({ where: { requestIp: ip } })).toBe(3);
      }
    });
  });
});
