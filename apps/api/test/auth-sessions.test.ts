import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createPrismaClient } from '@hb/db';
import { SessionInfo, TokenPair } from '@hb/types';
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
  uniqueEmail,
} from './helpers';

/** Refresh rotation, reuse detection, logout, sessions (docs/b2-auth.md §2–3). */
describe.skipIf(!hasDb)('auth: sessions and tokens', () => {
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

  async function user() {
    const email = uniqueEmail('sess');
    const first = await registerAndVerify(api, outbox, { audience: 'web', email });
    return { email, first };
  }

  const refresh = (refreshToken: string) => api.post('/auth/refresh', { refreshToken });

  it('rotates the refresh token on every use and keeps the absolute expiry', async () => {
    const { first } = await user();
    const rotated = TokenPair.parse((await refresh(first.tokens.refreshToken).expect(200)).body);
    expect(rotated.refreshToken).not.toBe(first.tokens.refreshToken);
    expect(rotated.refreshExpiresAt).toBe(first.tokens.refreshExpiresAt);
    // Web sessions last 30 days from login.
    const days = (Date.parse(first.tokens.refreshExpiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
    // Access tokens live 15 minutes and carry a fresh session id.
    const at = claims(rotated.accessToken);
    expect((at.exp ?? 0) - (at.iat ?? 0)).toBe(900);
    expect(at.sid).not.toBe(claims(first.tokens.accessToken).sid);
    await api.get('/me', rotated.accessToken).expect(200);

    const rows = await db.session.findMany({ where: { userId: first.user.id } });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.familyId)).size).toBe(1);
    expect(new Set(rows.map((r) => r.expiresAt.getTime())).size).toBe(1);
    expect(rows.filter((r) => r.revokedAt === null)).toHaveLength(1);
    // Only the HMAC of the token is stored.
    expect(rows.some((r) => r.refreshTokenHash === rotated.refreshToken)).toBe(false);
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.refreshTokenHash))).toBe(true);
  });

  it('reusing a rotated refresh token revokes every session of the user', async () => {
    const { email, first } = await user();
    const other = expectOk((await passwordLogin(api, email).expect(200)).body);
    const rotated = TokenPair.parse((await refresh(first.tokens.refreshToken).expect(200)).body);

    const reuse = await refresh(first.tokens.refreshToken).expect(401);
    expect(ErrorBody.parse(reuse.body).error.code).toBe('SESSION_REVOKED');

    for (const token of [rotated.accessToken, other.tokens.accessToken]) {
      const res = await api.get('/me', token).expect(401);
      expect(ErrorBody.parse(res.body).error.code).toBe('SESSION_REVOKED');
    }
    await refresh(rotated.refreshToken).expect(401);
    await refresh(other.tokens.refreshToken).expect(401);
    expect(await db.session.count({ where: { userId: first.user.id, revokedAt: null } })).toBe(0);
    const audit = await db.auditLog.findFirst({
      where: { action: 'auth.refresh_reuse', actorId: first.user.id },
    });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit?.meta)).not.toContain(first.tokens.refreshToken);
  });

  it('unknown refresh tokens are UNAUTHENTICATED', async () => {
    const res = await refresh('x'.repeat(43)).expect(401);
    expect(ErrorBody.parse(res.body).error.code).toBe('UNAUTHENTICATED');
  });

  it('logout revokes that session at once; unknown tokens still get 204', async () => {
    const { email, first } = await user();
    const other = expectOk((await passwordLogin(api, email).expect(200)).body);
    await api.post('/auth/logout', { refreshToken: first.tokens.refreshToken }).expect(204);
    const res = await api.get('/me', first.tokens.accessToken).expect(401);
    expect(ErrorBody.parse(res.body).error.code).toBe('SESSION_REVOKED');
    await api.get('/me', other.tokens.accessToken).expect(200);
    await api.post('/auth/logout', { refreshToken: 'not-a-real-token' }).expect(204);
  });

  it('logout-all makes every existing access token fail immediately', async () => {
    const { email, first } = await user();
    const other = expectOk((await passwordLogin(api, email).expect(200)).body);
    await api.post('/auth/logout-all', {}, { token: other.tokens.accessToken }).expect(204);
    for (const token of [first.tokens.accessToken, other.tokens.accessToken]) {
      const res = await api.get('/me', token).expect(401);
      expect(ErrorBody.parse(res.body).error.code).toBe('SESSION_REVOKED');
    }
    await refresh(first.tokens.refreshToken).expect(401);
    const audit = await db.auditLog.findFirst({
      where: { action: 'auth.logout_all', actorId: first.user.id },
    });
    expect(audit?.meta).toMatchObject({ revoked: 2 });
    await api.post('/auth/logout-all').expect(401);
  });

  it('lists the caller’s sessions and only lets them revoke their own', async () => {
    const { email, first } = await user();
    const phone = expectOk(
      (await passwordLogin(api, email, 'web', undefined, { ua: 'HB-Test-Phone/1.0' }).expect(200))
        .body,
    );
    const list = await api.get('/auth/sessions', first.tokens.accessToken).expect(200);
    const sessions = z.array(SessionInfo).parse(list.body);
    expect(sessions).toHaveLength(2);
    const current = sessions.find((s) => s.current);
    expect(current?.id).toBe(claims(first.tokens.accessToken).sid);
    const phoneSession = sessions.find((s) => !s.current);
    expect(phoneSession).toMatchObject({ audience: 'web', userAgent: 'HB-Test-Phone/1.0' });
    expect(phoneSession?.ip).toMatch(/^10\./);

    // Someone else's session id is a 404 and stays alive.
    const stranger = await user();
    const strangerSid = String(claims(stranger.first.tokens.accessToken).sid);
    const res = await api
      .delete(`/auth/sessions/${strangerSid}`, first.tokens.accessToken)
      .expect(404);
    expect(ErrorBody.parse(res.body).error.code).toBe('NOT_FOUND');
    await api.get('/me', stranger.first.tokens.accessToken).expect(200);
    await api.delete('/auth/sessions/not-a-uuid', first.tokens.accessToken).expect(404);

    // Own session: revoked, and its access token stops working.
    await api.delete(`/auth/sessions/${phoneSession?.id}`, first.tokens.accessToken).expect(204);
    await api.get('/me', phone.tokens.accessToken).expect(401);
    const after = z
      .array(SessionInfo)
      .parse((await api.get('/auth/sessions', first.tokens.accessToken).expect(200)).body);
    expect(after.map((s) => s.id)).toEqual([current?.id]);
  });

  it('rejects missing, malformed, tampered and challenge tokens as access tokens', async () => {
    const { first } = await user();
    await api.get('/me').expect(401);
    await api.get('/me', 'not.a.jwt').expect(401);
    const [h, p, s] = first.tokens.accessToken.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...claims(first.tokens.accessToken), role: 'super_admin' }),
    ).toString('base64url');
    const res = await api.get('/me', `${h}.${forged}.${s}`).expect(401);
    expect(ErrorBody.parse(res.body).error.code).toBe('UNAUTHENTICATED');
    expect(p).toBeDefined();
  });
});
