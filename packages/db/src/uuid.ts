import { randomBytes } from 'node:crypto';

const MAX_UNIX_MS = 2 ** 48 - 1;
const MAX_SEQ = 0xfff;

let lastMs = -1;
let seq = 0;

/**
 * UUID version 7 (RFC 9562 §5.7): 48-bit big-endian Unix epoch milliseconds,
 * 4-bit version (0b0111), 12-bit `rand_a`, 2-bit variant (0b10), 62 random bits.
 *
 * Without an explicit timestamp, IDs are monotonic within this process
 * (RFC 9562 §6.2 method 1): `rand_a` is a counter seeded randomly each
 * millisecond, so rows inserted in a loop keep their insertion order when
 * sorted by id. With an explicit timestamp, `rand_a` is random.
 */
export function uuidv7(unixMs?: number): string {
  let ms: number;
  let randA: number;
  if (unixMs === undefined) {
    const now = Date.now();
    if (now > lastMs) {
      lastMs = now;
      // Start in the lower half so a burst has room to count up.
      seq = randomBytes(2).readUInt16BE(0) & 0x7ff;
    } else if (seq < MAX_SEQ) {
      seq += 1;
    } else {
      lastMs += 1;
      seq = 0;
    }
    ms = lastMs;
    randA = seq;
  } else {
    ms = unixMs;
    randA = randomBytes(2).readUInt16BE(0) & MAX_SEQ;
  }
  if (!Number.isInteger(ms) || ms < 0 || ms > MAX_UNIX_MS) {
    throw new RangeError(`uuidv7: timestamp out of range: ${ms}`);
  }
  const bytes = randomBytes(16);
  bytes.writeUIntBE(ms, 0, 6);
  bytes.writeUInt8(0x70 | (randA >> 8), 6); // version 7 + high bits of rand_a
  bytes.writeUInt8(randA & 0xff, 7);
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8); // variant 10xx
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
