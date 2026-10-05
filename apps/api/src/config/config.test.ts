import { generateKeyPairSync } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { beforeAll, describe, expect, it } from 'vitest';
import { ConfigError, DEV_FALLBACKS, DEV_STOREFRONT_KEY, loadConfig } from './config';

const pemPair = (type: 'ed25519' | 'ed448' = 'ed25519') => {
  const { privateKey, publicKey } = generateKeyPairSync(type as 'ed25519');
  return {
    JWT_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    JWT_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
};

const production = () => ({
  NODE_ENV: 'production',
  ...pemPair(),
  REFRESH_TOKEN_PEPPER: 'prod-refresh-pepper-0123456789abcdef',
  OTP_PEPPER: 'prod-otp-pepper-0123456789abcdef',
  ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
});

describe('loadConfig', () => {
  beforeAll(() => Logger.overrideLogger(false));

  it('dev/test: ephemeral Ed25519 keys and clearly-fake fallbacks', () => {
    const c = loadConfig({ NODE_ENV: 'development', JWT_PRIVATE_KEY: '', JWT_PUBLIC_KEY: '' });
    expect(c.isProduction).toBe(false);
    expect(c.jwt.ephemeral).toBe(true);
    expect(c.jwt.privateKey.asymmetricKeyType).toBe('ed25519');
    expect(c.refreshTokenPepper).toBe(DEV_FALLBACKS.refreshTokenPepper);
    expect(c.otpPepper).toBe(DEV_FALLBACKS.otpPepper);
    expect(c.encryptionKey).toHaveLength(32);
    expect(c.trustProxy).toBe('loopback');
    expect(c.turnstileSecretKey).toBeNull();
    expect(c.hibpEnabled).toBe(false);
    expect(c.storefrontKey).toBeNull();
    expect(loadConfig({ STOREFRONT_API_KEY: DEV_STOREFRONT_KEY }).storefrontKey).toBe(
      DEV_STOREFRONT_KEY,
    );
  });

  it('production refuses to boot without keys, peppers and the encryption key', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(ConfigError);
    for (const missing of [
      'JWT_PRIVATE_KEY',
      'REFRESH_TOKEN_PEPPER',
      'OTP_PEPPER',
      'ENCRYPTION_KEY',
    ]) {
      const env: Record<string, string> = production();
      delete env[missing];
      expect(() => loadConfig(env), missing).toThrow(ConfigError);
    }
  });

  it('production refuses the dev values from .env.example', () => {
    expect(() =>
      loadConfig({ ...production(), REFRESH_TOKEN_PEPPER: DEV_FALLBACKS.refreshTokenPepper }),
    ).toThrow(/REFRESH_TOKEN_PEPPER/);
    expect(() =>
      loadConfig({ ...production(), ENCRYPTION_KEY: DEV_FALLBACKS.encryptionKey }),
    ).toThrow(/ENCRYPTION_KEY/);
    expect(() => loadConfig({ ...production(), STOREFRONT_API_KEY: DEV_STOREFRONT_KEY })).toThrow(
      /STOREFRONT_API_KEY/,
    );
  });

  it('production boots with a full, valid set (PEMs may use \\n escapes)', () => {
    const env = production();
    const c = loadConfig({
      ...env,
      JWT_PRIVATE_KEY: env.JWT_PRIVATE_KEY.replace(/\n/g, '\\n'),
      TRUST_PROXY: '1',
      HIBP_ENABLED: 'true',
      TURNSTILE_SECRET_KEY: 'x',
      STOREFRONT_API_KEY: 'prod-storefront-key-0123456789abcdef',
    });
    expect(c.jwt.ephemeral).toBe(false);
    expect(c.trustProxy).toBe(1);
    expect(c.hibpEnabled).toBe(true);
    expect(c.turnstileSecretKey).toBe('x');
    expect(c.storefrontKey).toBe('prod-storefront-key-0123456789abcdef');
    // Optional: without it the storefront server's reads count against its own IP.
    expect(loadConfig(env).storefrontKey).toBeNull();
  });

  it('rejects mismatched, non-Ed25519, half-set or malformed keys and bad values', () => {
    const a = pemPair();
    const b = pemPair();
    expect(() =>
      loadConfig({ JWT_PRIVATE_KEY: a.JWT_PRIVATE_KEY, JWT_PUBLIC_KEY: b.JWT_PUBLIC_KEY }),
    ).toThrow(/does not match/);
    expect(() => loadConfig({ ...pemPair('ed448') })).toThrow(/Ed25519/);
    expect(() => loadConfig({ JWT_PRIVATE_KEY: a.JWT_PRIVATE_KEY })).toThrow(/both/);
    expect(() => loadConfig({ JWT_PRIVATE_KEY: 'nope', JWT_PUBLIC_KEY: 'nope' })).toThrow(/PEM/);
    expect(() => loadConfig({ ENCRYPTION_KEY: Buffer.alloc(16).toString('base64') })).toThrow(
      /32 bytes/,
    );
    expect(() => loadConfig({ OTP_PEPPER: 'short' })).toThrow(/OTP_PEPPER/);
    expect(() => loadConfig({ HIBP_ENABLED: 'yes' })).toThrow(/HIBP_ENABLED/);
    expect(() => loadConfig({ STOREFRONT_API_KEY: 'short' })).toThrow(/STOREFRONT_API_KEY/);
  });
});
