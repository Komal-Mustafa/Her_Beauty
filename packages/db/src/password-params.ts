/**
 * Argon2id parameters shared by the API (PasswordService) and the dev seed, so seeded demo
 * passwords verify exactly like real ones. OWASP 2024 minimum (docs/b2-auth.md §4):
 * 19 MiB memory, 2 passes, 1 lane. `algorithm: 2` is Argon2id in @node-rs/argon2's
 * `Algorithm` const enum (declared as a plain number so this package needs no argon2 import).
 */
export const PASSWORD_HASH_PARAMS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;
