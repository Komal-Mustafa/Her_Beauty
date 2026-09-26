-- B2 fix: why a session was revoked (docs/b2-auth.md §2). Only a row revoked by rotation counts as
-- refresh-token reuse when its token comes back; rows revoked on purpose (logout, signing out one
-- device, password reset, ...) just answer 401 and leave the user's other sessions alone.
-- Nullable column (no table rewrite); `sessions` is small at this point, so validating the CHECK
-- inline is cheap.

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "revoked_reason" TEXT;

-- Hand-written: allowed reasons, and a reason only on a revoked row.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_revoked_reason_check" CHECK (
  revoked_reason IS NULL
  OR (
    revoked_at IS NOT NULL
    AND revoked_reason IN (
      'rotated', 'logout', 'logout_all', 'device_revoked', 'password_reset', 'reuse',
      'access_lost', 'account_claimed'
    )
  )
);

-- Backfill: a revoked row followed by a newer row of the same family (UUIDv7 ids sort by time) was
-- rotated. Other revoked rows stay NULL = revoked on purpose, so they never trigger reuse handling.
UPDATE "sessions" s
SET "revoked_reason" = 'rotated'
WHERE s."revoked_at" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "sessions" n WHERE n."family_id" = s."family_id" AND n."id" > s."id"
  );
