-- B2 fix (docs/b2-auth.md §3): at sign-up only the primary identifier (the email, else the mobile
-- number) is bound to the account. A mobile number given next to an email is kept in
-- users.pending_phone until its owner verifies it: it is not unique, receives no codes and cannot be
-- used to sign in or reset the password, so nobody can claim, block or probe a number they do not
-- own. Nullable column, no table rewrite.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pending_phone" TEXT;

-- Unverified numbers already stored next to an email stop being identifiers. (users keeps its
-- "email or phone" CHECK: only rows with an email are touched.)
UPDATE "users"
SET "pending_phone" = "phone", "phone" = NULL
WHERE "phone" IS NOT NULL AND "phone_verified_at" IS NULL AND "email" IS NOT NULL;
