import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
} from 'node:crypto';
import { Logger } from '@nestjs/common';
import { z } from 'zod';

/**
 * API configuration, read once from the environment and validated (docs/b2-auth.md §2, §9).
 * Production refuses to boot without real JWT keys, peppers and an encryption key. Outside
 * production, missing values fall back to clearly-fake dev values and the JWT key pair is
 * generated per process (tokens die with the process — fine for dev and tests).
 */
export const APP_CONFIG = Symbol('APP_CONFIG');

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  jwt: { privateKey: KeyObject; publicKey: KeyObject; ephemeral: boolean };
  refreshTokenPepper: string;
  otpPepper: string;
  /** 32-byte AES-256-GCM key (key version 1). */
  encryptionKey: Buffer;
  /** Express "trust proxy" setting. */
  trustProxy: boolean | number | string;
  turnstileSecretKey: string | null;
  hibpEnabled: boolean;
}

/** Same values as .env.example. Never accepted in production. */
export const DEV_FALLBACKS = {
  refreshTokenPepper: 'dev-only-refresh-pepper-change-me',
  otpPepper: 'dev-only-otp-pepper-change-me',
  encryptionKey: 'ZGV2LW9ubHktbm90LWEtc2VjcmV0LTMyLWJ5dGVzISE=',
} as const;

const optional = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().optional(),
);

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  JWT_PRIVATE_KEY: optional,
  JWT_PUBLIC_KEY: optional,
  REFRESH_TOKEN_PEPPER: optional.pipe(z.string().min(16).optional()),
  OTP_PEPPER: optional.pipe(z.string().min(16).optional()),
  ENCRYPTION_KEY: optional,
  TRUST_PROXY: optional,
  TURNSTILE_SECRET_KEY: optional,
  HIBP_ENABLED: optional.pipe(z.enum(['true', 'false']).optional()),
});

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/** PEM values in .env files often carry literal "\n" sequences. */
const pem = (value: string) => value.replace(/\\n/g, '\n').trim();

function loadJwtKeys(
  env: z.infer<typeof EnvSchema>,
  isProduction: boolean,
  log: Logger,
): AppConfig['jwt'] {
  const { JWT_PRIVATE_KEY: priv, JWT_PUBLIC_KEY: pub } = env;
  if (!priv && !pub) {
    if (isProduction) throw new ConfigError('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required');
    log.warn('JWT keys not set: using an ephemeral Ed25519 key pair (dev/test only)');
    const pair = generateKeyPairSync('ed25519');
    return { privateKey: pair.privateKey, publicKey: pair.publicKey, ephemeral: true };
  }
  if (!priv || !pub) throw new ConfigError('Set both JWT_PRIVATE_KEY and JWT_PUBLIC_KEY');
  let privateKey: KeyObject;
  let publicKey: KeyObject;
  try {
    privateKey = createPrivateKey(pem(priv));
    publicKey = createPublicKey(pem(pub));
  } catch {
    throw new ConfigError('JWT keys must be PKCS8 (private) and SPKI (public) PEM');
  }
  if (privateKey.asymmetricKeyType !== 'ed25519' || publicKey.asymmetricKeyType !== 'ed25519') {
    throw new ConfigError('JWT keys must be Ed25519');
  }
  const derived = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  if (!derived.equals(publicKey.export({ type: 'spki', format: 'der' }))) {
    throw new ConfigError('JWT_PUBLIC_KEY does not match JWT_PRIVATE_KEY');
  }
  return { privateKey, publicKey, ephemeral: false };
}

function secret(
  name: string,
  value: string | undefined,
  fallback: string,
  isProduction: boolean,
): string {
  if (value && !(isProduction && value === fallback)) return value;
  if (isProduction) throw new ConfigError(`${name} is required in production (no dev value)`);
  return fallback;
}

function parseEncryptionKey(value: string, isProduction: boolean): Buffer {
  if (isProduction && value === DEV_FALLBACKS.encryptionKey) {
    throw new ConfigError('ENCRYPTION_KEY is required in production (no dev value)');
  }
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new ConfigError('ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  return key;
}

/** "true"/"false", a hop count, or an Express trust list such as "loopback, 10.0.0.0/8". */
function parseTrustProxy(value: string | undefined): AppConfig['trustProxy'] {
  if (value === undefined) return 'loopback';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const log = new Logger('Config');
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new ConfigError(`Invalid environment: ${fields}`);
  }
  const e = parsed.data;
  const isProduction = e.NODE_ENV === 'production';
  const encryptionKey = secret(
    'ENCRYPTION_KEY',
    e.ENCRYPTION_KEY,
    DEV_FALLBACKS.encryptionKey,
    isProduction,
  );
  return {
    nodeEnv: e.NODE_ENV,
    isProduction,
    jwt: loadJwtKeys(e, isProduction, log),
    refreshTokenPepper: secret(
      'REFRESH_TOKEN_PEPPER',
      e.REFRESH_TOKEN_PEPPER,
      DEV_FALLBACKS.refreshTokenPepper,
      isProduction,
    ),
    otpPepper: secret('OTP_PEPPER', e.OTP_PEPPER, DEV_FALLBACKS.otpPepper, isProduction),
    encryptionKey: parseEncryptionKey(encryptionKey, isProduction),
    trustProxy: parseTrustProxy(e.TRUST_PROXY),
    turnstileSecretKey: e.TURNSTILE_SECRET_KEY ?? null,
    hibpEnabled: e.HIBP_ENABLED === 'true',
  };
}
