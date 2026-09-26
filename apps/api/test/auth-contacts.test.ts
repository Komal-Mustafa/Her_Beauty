import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@hb/db';
import { CodeSent, Me } from '@hb/types';
import type { MemoryMessageProvider } from '../src/messaging/message-provider';
import {
  Api,
  cleanup,
  createTestApp,
  ErrorBody,
  expectOk,
  hasDb,
  passwordLogin,
  registerAndVerify,
  STRONG_PASSWORD,
  uniqueEmail,
  uniquePhone,
} from './helpers';

/**
 * A signed-in user confirms the email or mobile number on their account (docs/b2-auth.md §3
 * "Confirming a contact"): the address comes from the account, the code is bound to the account,
 * and a confirmed mobile number becomes a sign-in identifier.
 */
describe.skipIf(!hasDb)('auth: confirming a contact', () => {
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

  /** A seller whose email is verified and whose sign-up number is still pending. */
  async function sellerWithPendingPhone() {
    const email = uniqueEmail('contact');
    const phone = uniquePhone();
    const login = await registerAndVerify(api, outbox, {
      audience: 'seller',
      email,
      phone: phone.local,
    });
    return { email, phone, token: login.tokens.accessToken, userId: login.user.id };
  }

  const errorCode = (body: unknown) => ErrorBody.parse(body).error.code;

  it('confirms the sign-up mobile number, which then signs in to the seller portal', async () => {
    const { email, phone, token, userId } = await sellerWithPendingPhone();
    const before = Me.parse((await api.get('/me', token).expect(200)).body);
    expect(before).toMatchObject({ phone: phone.e164, phoneVerified: false });
    expect(errorCode((await passwordLogin(api, phone.local, 'seller').expect(401)).body)).toBe(
      'INVALID_CREDENTIALS',
    );

    const sent = await api.post('/me/contacts/send', { channel: 'sms' }, { token }).expect(202);
    expect(CodeSent.parse(sent.body).status).toBe('sent');
    const message = outbox.last(phone.e164);
    expect(message?.text).toMatch(/confirmation code is \d{6}/);

    const res = await api
      .post('/me/contacts/verify', { channel: 'sms', code: outbox.lastCode(phone.e164) }, { token })
      .expect(200);
    expect(Me.parse(res.body)).toMatchObject({ phone: phone.e164, phoneVerified: true });
    const row = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(row).toMatchObject({ phone: phone.e164, pendingPhone: null });
    expect(row.phoneVerifiedAt).not.toBeNull();

    expectOk((await passwordLogin(api, phone.local, 'seller').expect(200)).body);
    const audit = await db.auditLog.findFirst({
      where: { action: 'auth.contact_verified', targetId: userId },
    });
    expect(audit?.meta).toEqual({
      channel: 'sms',
      masked: expect.stringMatching(/^\+92 3\d\d •••• \d{3}$/),
    });
    // The confirmed email hears about the new way to log in.
    expect(outbox.last(email)?.subject).toBe(
      'A mobile number was added to your Her Beauty account',
    );
  });

  it('never offers a number kept from a sign-up the owner did not finish with its own code', async () => {
    // Someone signs up with the owner's email and their own number; the owner proves the email
    // with a code sent again (not the sign-up's own).
    const email = uniqueEmail('squatted');
    const squatter = uniquePhone();
    await api
      .post('/auth/register', {
        audience: 'seller',
        sellerType: 'vendor',
        storeName: 'Squatted Store',
        fullName: 'Squatter',
        email,
        phone: squatter.local,
        password: STRONG_PASSWORD,
      })
      .expect(202);
    const send = { audience: 'seller', channel: 'email', target: email, purpose: 'verify' };
    await api.post('/auth/otp/send', send).expect(202);
    const res = await api
      .post('/auth/otp/verify', { ...send, code: outbox.lastCode(email) })
      .expect(200);
    const owner = expectOk(res.body);
    expect(owner.user).toMatchObject({ phone: null, hasPassword: false });

    const sent = outbox.to(squatter.e164).length;
    const none = await api
      .post('/me/contacts/send', { channel: 'sms' }, { token: owner.tokens.accessToken })
      .expect(400);
    expect(errorCode(none.body)).toBe('VALIDATION_FAILED');
    expect(outbox.to(squatter.e164)).toHaveLength(sent);
  });

  it('needs a session', async () => {
    const res = await api.post('/me/contacts/send', { channel: 'sms' }).expect(401);
    expect(errorCode(res.body)).toBe('UNAUTHENTICATED');
    await api.post('/me/contacts/verify', { channel: 'sms', code: '123456' }).expect(401);
  });

  it('never takes an address from the request', async () => {
    const { token } = await sellerWithPendingPhone();
    const other = uniquePhone();
    const res = await api
      .post('/me/contacts/send', { channel: 'sms', target: other.local }, { token })
      .expect(400);
    expect(errorCode(res.body)).toBe('VALIDATION_FAILED');
    expect(outbox.to(other.e164)).toHaveLength(0);
  });

  it('refuses addresses that are confirmed already or missing', async () => {
    const { email, token } = await sellerWithPendingPhone();
    const sentBefore = outbox.to(email).length;
    const confirmed = await api
      .post('/me/contacts/send', { channel: 'email' }, { token })
      .expect(409);
    expect(errorCode(confirmed.body)).toBe('CONFLICT');
    expect(outbox.to(email)).toHaveLength(sentBefore);

    const customer = await registerAndVerify(api, outbox, {
      audience: 'web',
      email: uniqueEmail('nophone'),
    });
    const missing = await api
      .post('/me/contacts/send', { channel: 'sms' }, { token: customer.tokens.accessToken })
      .expect(400);
    expect(errorCode(missing.body)).toBe('VALIDATION_FAILED');
  });

  it('binds the code to the account that asked for it, and no other account can spend it', async () => {
    const a = await sellerWithPendingPhone();
    // B typed the same number at sign-up (pending numbers are not unique).
    const bEmail = uniqueEmail('contact-b');
    const b = await registerAndVerify(api, outbox, {
      audience: 'web',
      email: bEmail,
      phone: a.phone.local,
    });
    const bToken = b.tokens.accessToken;

    await api.post('/me/contacts/send', { channel: 'sms' }, { token: a.token }).expect(202);
    const aCode = outbox.lastCode(a.phone.e164) ?? '';
    const stolen = await api
      .post('/me/contacts/verify', { channel: 'sms', code: aCode }, { token: bToken })
      .expect(400);
    expect(errorCode(stolen.body)).toBe('INVALID_CODE');
    // B's wrong tries and B's own new code leave A's code alone.
    const wrong = aCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 2; i += 1) {
      await api
        .post('/me/contacts/verify', { channel: 'sms', code: wrong }, { token: bToken })
        .expect(400);
    }
    await api.post('/me/contacts/send', { channel: 'sms' }, { token: bToken }).expect(202);

    await api
      .post('/me/contacts/verify', { channel: 'sms', code: aCode }, { token: a.token })
      .expect(200);

    // B's code (sent before A confirmed) proves the number too, but A holds it now: refused,
    // B's account is unchanged, and the code is used up.
    const bCode = outbox.lastCode(a.phone.e164);
    const taken = await api
      .post('/me/contacts/verify', { channel: 'sms', code: bCode }, { token: bToken })
      .expect(409);
    expect(errorCode(taken.body)).toBe('CONFLICT');
    const replay = await api
      .post('/me/contacts/verify', { channel: 'sms', code: bCode }, { token: bToken })
      .expect(400);
    expect(errorCode(replay.body)).toBe('INVALID_CODE');
    const bMe = Me.parse((await api.get('/me', bToken).expect(200)).body);
    expect(bMe).toMatchObject({ phone: a.phone.e164, phoneVerified: false });
  });

  it('a code allows three tries; a confirmed number cannot be confirmed again', async () => {
    const { phone, token } = await sellerWithPendingPhone();
    await api.post('/me/contacts/send', { channel: 'sms' }, { token }).expect(202);
    const code = outbox.lastCode(phone.e164) ?? '';
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 3; i += 1) {
      await api.post('/me/contacts/verify', { channel: 'sms', code: wrong }, { token }).expect(400);
    }
    await api.post('/me/contacts/verify', { channel: 'sms', code }, { token }).expect(400);

    await api.post('/me/contacts/send', { channel: 'sms' }, { token }).expect(202);
    const fresh = outbox.lastCode(phone.e164) ?? '';
    await api.post('/me/contacts/verify', { channel: 'sms', code: fresh }, { token }).expect(200);
    // Confirmed now: answered before any code is checked.
    const again = await api
      .post('/me/contacts/verify', { channel: 'sms', code: fresh }, { token })
      .expect(409);
    expect(errorCode(again.body)).toBe('CONFLICT');
  });

  it('sends at most three codes to a number per 15 minutes', async () => {
    const { token } = await sellerWithPendingPhone();
    for (let i = 0; i < 3; i += 1) {
      await api.post('/me/contacts/send', { channel: 'sms' }, { token }).expect(202);
    }
    const res = await api.post('/me/contacts/send', { channel: 'sms' }, { token }).expect(429);
    expect(errorCode(res.body)).toBe('RATE_LIMITED');
  });
});
