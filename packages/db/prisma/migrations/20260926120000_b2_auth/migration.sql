-- B2 accounts + login (docs/b2-auth.md §6). All changes are additive; tables are empty or tiny at this point,
-- so the NOT NULL + constant DEFAULT column (no table rewrite on PG 11+) and plain CREATE INDEX are safe.

-- AlterTable
ALTER TABLE "otp_codes" ADD COLUMN     "request_ip" INET;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'web',
ADD COLUMN     "last_used_at" TIMESTAMPTZ(6),
ADD COLUMN     "mfa_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "twofa_last_step" BIGINT;

-- CreateTable
CREATE TABLE "twofa_backup_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "twofa_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "twofa_backup_codes_code_hash_key" ON "twofa_backup_codes"("code_hash");

-- CreateIndex
CREATE INDEX "twofa_backup_codes_user_id_idx" ON "twofa_backup_codes"("user_id");

-- CreateIndex
CREATE INDEX "otp_codes_request_ip_created_at_idx" ON "otp_codes"("request_ip", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "twofa_backup_codes" ADD CONSTRAINT "twofa_backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;


-- Hand-written: which app a session belongs to.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_audience_check" CHECK (audience IN ('web', 'seller', 'admin'));
