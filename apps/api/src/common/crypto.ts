import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

/** HMAC-SHA256 as lower-case hex. Used for refresh tokens, OTPs and backup codes at rest. */
export function hmacSha256Hex(key: string | Buffer, data: string): string {
  return createHmac('sha256', key).update(data, 'utf8').digest('hex');
}

/** Constant-time string comparison (length is not secret here: both sides are fixed-size hashes). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) {
    // Still spend the comparison so the early exit is not a timing signal of its own.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/** `bytes` random bytes as base64url (32 bytes ⇒ 43 characters). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Uniformly random decimal string, e.g. a 6-digit OTP (leading zeros kept). */
export function randomDigits(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += String(randomInt(10));
  return out;
}

// ---------- AES-256-GCM ----------
// Layout (docs/b2-auth.md §4): [1 byte key version][12 byte IV][16 byte tag][ciphertext].

const KEY_VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = 1 + IV_BYTES + TAG_BYTES;

export function encrypt(key: Buffer, plaintext: Buffer, aad?: string): Buffer {
  if (key.length !== 32) throw new Error('encrypt: key must be 32 bytes');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
  if (aad !== undefined) cipher.setAAD(Buffer.from(aad, 'utf8'));
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([Buffer.of(KEY_VERSION), iv, cipher.getAuthTag(), body]);
}

/** Throws when the key version is unknown or the data was tampered with. */
export function decrypt(key: Buffer, blob: Uint8Array, aad?: string): Buffer {
  const data = Buffer.from(blob);
  if (data.length < HEADER_BYTES) throw new Error('decrypt: ciphertext too short');
  if (data[0] !== KEY_VERSION) throw new Error(`decrypt: unknown key version ${data[0]}`);
  const iv = data.subarray(1, 1 + IV_BYTES);
  const tag = data.subarray(1 + IV_BYTES, HEADER_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);
  if (aad !== undefined) decipher.setAAD(Buffer.from(aad, 'utf8'));
  return Buffer.concat([decipher.update(data.subarray(HEADER_BYTES)), decipher.final()]);
}

// ---------- Crockford base32 backup codes ----------

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const BACKUP_CODE_LENGTH = 10;

/** 10 random Crockford base32 characters (50 bits), displayed as XXXXX-XXXXX. */
export function generateBackupCode(): string {
  let raw = '';
  for (let i = 0; i < BACKUP_CODE_LENGTH; i++) raw += CROCKFORD[randomInt(CROCKFORD.length)];
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/**
 * Canonical form used for hashing: upper-case, no dash, Crockford aliases folded
 * (I/L ⇒ 1, O ⇒ 0). Returns null when the input cannot be a backup code.
 */
export function normaliseBackupCode(input: string): string | null {
  const folded = input
    .trim()
    .toUpperCase()
    .replace(/-/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  if (folded.length !== BACKUP_CODE_LENGTH) return null;
  for (const ch of folded) if (!CROCKFORD.includes(ch)) return null;
  return folded;
}
