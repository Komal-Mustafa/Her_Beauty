import { generateKeyPairSync } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { SignJWT, UnsecuredJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { uuidv7 } from '@hb/db';
import { loadConfig } from '../config/config';
import { InvalidTokenError, ISSUER, TokenService } from './token.service';

describe('TokenService', () => {
  let tokens: TokenService;
  let config: ReturnType<typeof loadConfig>;
  const userId = uuidv7();
  const sessionId = uuidv7();

  beforeAll(() => {
    Logger.overrideLogger(false);
    config = loadConfig({ NODE_ENV: 'test' });
    tokens = new TokenService(config);
  });

  it('signs EdDSA access tokens that verify back to the same context', async () => {
    const sellerId = uuidv7();
    const { token, expiresAt } = await tokens.signAccess({
      userId,
      sessionId,
      audience: 'seller',
      role: 'seller',
      mfa: false,
      sellerId,
      sellerRole: 'owner',
    });
    expect(JSON.parse(Buffer.from(token.split('.')[0] ?? '', 'base64url').toString())).toEqual({
      alg: 'EdDSA',
      typ: 'JWT',
    });
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(14 * 60_000);
    await expect(tokens.verifyAccess(token)).resolves.toEqual({
      userId,
      sessionId,
      audience: 'seller',
      role: 'seller',
      mfa: false,
      sellerId,
      sellerRole: 'owner',
    });
  });

  it('never accepts a challenge token as an access token, and vice versa', async () => {
    const mfa = await tokens.signChallenge('mfa', 'admin', userId);
    const setup = await tokens.signChallenge('mfa_setup', 'admin', userId);
    expect(mfa.expiresInSec).toBe(300);
    await expect(tokens.verifyAccess(mfa.token)).rejects.toBeInstanceOf(InvalidTokenError);
    await expect(tokens.verifyAccess(setup.token)).rejects.toBeInstanceOf(InvalidTokenError);
    await expect(tokens.verifyChallenge(mfa.token, 'mfa')).resolves.toEqual({
      userId,
      audience: 'admin',
    });
    await expect(tokens.verifyChallenge(mfa.token, 'mfa_setup')).rejects.toThrow();
    await expect(tokens.verifyChallenge(setup.token, 'mfa')).rejects.toThrow();
    const access = await tokens.signAccess({
      userId,
      sessionId,
      audience: 'web',
      role: 'customer',
      mfa: false,
    });
    await expect(tokens.verifyChallenge(access.token, 'mfa')).rejects.toThrow();
  });

  it('rejects any token with a typ claim, even with valid access claims', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sid: sessionId, role: 'admin', mfa: true, typ: 'refresh' })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuer(ISSUER)
      .setAudience('admin')
      .setSubject(userId)
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .setJti(uuidv7())
      .sign(config.jwt.privateKey);
    await expect(tokens.verifyAccess(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('rejects other keys, expiry, alg "none", foreign issuers and audiences', async () => {
    const now = Math.floor(Date.now() / 1000);
    const base = (claims: Record<string, unknown> = {}) =>
      new SignJWT({ sid: sessionId, role: 'customer', mfa: false, ...claims })
        .setProtectedHeader({ alg: 'EdDSA' })
        .setSubject(userId)
        .setIssuedAt(now - 120)
        .setJti(uuidv7());
    const other = generateKeyPairSync('ed25519').privateKey;
    const cases = [
      await base()
        .setIssuer(ISSUER)
        .setAudience('web')
        .setExpirationTime(now + 60)
        .sign(other),
      await base()
        .setIssuer(ISSUER)
        .setAudience('web')
        .setExpirationTime(now - 60)
        .sign(config.jwt.privateKey),
      await base()
        .setIssuer('someone-else')
        .setAudience('web')
        .setExpirationTime(now + 60)
        .sign(config.jwt.privateKey),
      await base()
        .setIssuer(ISSUER)
        .setAudience('partner')
        .setExpirationTime(now + 60)
        .sign(config.jwt.privateKey),
      await base()
        .setIssuer(ISSUER)
        .setAudience(['web', 'admin'])
        .setExpirationTime(now + 60)
        .sign(config.jwt.privateKey),
      new UnsecuredJWT({ sid: sessionId, role: 'customer', mfa: false })
        .setIssuer(ISSUER)
        .setAudience('web')
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime('5m')
        .encode(),
    ];
    for (const token of cases) {
      await expect(tokens.verifyAccess(token)).rejects.toBeInstanceOf(InvalidTokenError);
    }
  });
});
