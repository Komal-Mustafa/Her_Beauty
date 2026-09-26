-- B2 fix: 2FA challenge tokens are single use (docs/b2-auth.md §3). When a challenge token completes
-- a sign-in, an otp_codes row with purpose 'challenge' stores HMAC(OTP_PEPPER, jti) until the token
-- expires; this index makes the first completion win when two requests race with one token.
-- Partial index (hand-written, like the others in the init migration); otp_codes is small.

CREATE UNIQUE INDEX "otp_codes_challenge_code_hash_key" ON "otp_codes" ("code_hash")
  WHERE "purpose" = 'challenge';
