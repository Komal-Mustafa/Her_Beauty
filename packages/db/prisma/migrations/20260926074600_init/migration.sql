-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('customer', 'seller', 'support', 'finance', 'admin', 'super_admin');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('active', 'locked', 'deleted');

-- CreateEnum
CREATE TYPE "seller_type" AS ENUM ('vendor', 'manufacturer');

-- CreateEnum
CREATE TYPE "seller_status" AS ENUM ('draft', 'submitted', 'changes_requested', 'approved', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "seller_member_role" AS ENUM ('owner', 'manager', 'catalog', 'orders', 'finance');

-- CreateEnum
CREATE TYPE "doc_status" AS ENUM ('pending', 'approved', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "sub_status" AS ENUM ('pending_payment', 'active', 'past_due', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "billing_cycle" AS ENUM ('monthly', 'quarterly', 'yearly');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('draft', 'pending_review', 'live', 'blocked', 'archived');

-- CreateEnum
CREATE TYPE "media_type" AS ENUM ('image', 'video', 'model3d');

-- CreateEnum
CREATE TYPE "media_status" AS ENUM ('uploading', 'processing', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('awaiting_payment', 'cod_pending', 'paid', 'partially_fulfilled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "seller_order_status" AS ENUM ('awaiting_payment', 'cod_pending', 'paid', 'accepted', 'shipped', 'in_transit', 'delivered', 'released', 'return_requested', 'returned', 'refunded', 'disputed', 'cancelled');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('card', 'jazzcash', 'easypaisa', 'bank_transfer', 'raast', 'cod', 'intl_card');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('created', 'pending', 'captured', 'failed', 'cancelled', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('requested', 'processing', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "shipping_mode" AS ENUM ('connected', 'manual', 'platform');

-- CreateEnum
CREATE TYPE "shipment_status" AS ENUM ('booked', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed_attempt', 'returned', 'cancelled');

-- CreateEnum
CREATE TYPE "delivery_proof" AS ENUM ('courier', 'otp', 'customer', 'auto');

-- CreateEnum
CREATE TYPE "dispute_status" AS ENUM ('open', 'seller_responded', 'admin_review', 'resolved_refund', 'resolved_release', 'closed');

-- CreateEnum
CREATE TYPE "ledger_owner" AS ENUM ('platform', 'seller', 'gateway', 'bank', 'customer');

-- CreateEnum
CREATE TYPE "ledger_account_type" AS ENUM ('escrow', 'wallet_held', 'wallet_available', 'revenue_commission', 'revenue_plans', 'revenue_ads', 'gateway_clearing', 'bank_clearing', 'payout_pending', 'cod_receivable', 'fees');

-- CreateEnum
CREATE TYPE "entry_direction" AS ENUM ('debit', 'credit');

-- CreateEnum
CREATE TYPE "payout_status" AS ENUM ('requested', 'approved', 'processing', 'paid', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ad_slot_code" AS ENUM ('hero', 'left_3d', 'right_video', 'category_banner', 'sponsored_product');

-- CreateEnum
CREATE TYPE "creative_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "campaign_status" AS ENUM ('draft', 'pending', 'scheduled', 'live', 'paused', 'ended', 'rejected');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT,
    "full_name" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'customer',
    "status" "user_status" NOT NULL DEFAULT 'active',
    "email_verified_at" TIMESTAMPTZ(6),
    "phone_verified_at" TIMESTAMPTZ(6),
    "twofa_secret_enc" BYTEA,
    "twofa_enabled_at" TIMESTAMPTZ(6),
    "failed_logins" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "user_agent" TEXT,
    "ip" INET,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "target" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" TEXT,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "area" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT,
    "postal_code" TEXT,
    "country" CHAR(2) NOT NULL DEFAULT 'PK',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sellers" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "type" "seller_type" NOT NULL,
    "status" "seller_status" NOT NULL DEFAULT 'draft',
    "legal_name" TEXT,
    "store_name" TEXT,
    "slug" TEXT,
    "business_type" TEXT,
    "ntn" TEXT,
    "secp_no" TEXT,
    "address" JSONB,
    "city" TEXT,
    "logo_key" TEXT,
    "banner_key" TEXT,
    "about" TEXT,
    "onboarding_step" SMALLINT NOT NULL DEFAULT 1,
    "commission_bps_override" INTEGER,
    "release_hold_days" SMALLINT,
    "strikes" SMALLINT NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "reviewed_by" UUID,
    "review_note" TEXT,
    "on_holiday_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_members" (
    "seller_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "seller_member_role" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_members_pkey" PRIMARY KEY ("seller_id","user_id")
);

-- CreateTable
CREATE TABLE "manufacturer_profiles" (
    "seller_id" UUID NOT NULL,
    "factory_addresses" JSONB NOT NULL DEFAULT '[]',
    "production_capacity" TEXT,
    "regulator_name" TEXT,
    "licence_no" TEXT,
    "licence_file_key" TEXT,
    "licence_expiry" DATE,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manufacturer_profiles_pkey" PRIMARY KEY ("seller_id")
);

-- CreateTable
CREATE TABLE "seller_documents" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "doc_type" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "id_last4" TEXT,
    "status" "doc_status" NOT NULL DEFAULT 'pending',
    "expires_at" DATE,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_bank_accounts" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_title" TEXT NOT NULL,
    "iban_enc" BYTEA NOT NULL,
    "iban_last4" TEXT NOT NULL,
    "iban_hash" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "verified_at" TIMESTAMPTZ(6),
    "payout_hold_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_application_log" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_application_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_key" TEXT,
    "owner_seller_id" UUID,
    "trademark_no" TEXT,
    "trademark_file_key" TEXT,
    "is_protected" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_authorizations" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "document_key" TEXT NOT NULL,
    "status" "doc_status" NOT NULL DEFAULT 'pending',
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "valid_until" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "selling_plans" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_monthly" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    "product_limit" INTEGER,
    "images_per_product" SMALLINT NOT NULL,
    "allow_video" BOOLEAN NOT NULL,
    "allow_3d" BOOLEAN NOT NULL,
    "staff_limit" SMALLINT NOT NULL,
    "commission_bps" INTEGER NOT NULL,
    "ad_discount_bps" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "selling_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_subscriptions" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "billing_cycle" "billing_cycle" NOT NULL DEFAULT 'monthly',
    "status" "sub_status" NOT NULL DEFAULT 'pending_payment',
    "current_period_start" TIMESTAMPTZ(6),
    "current_period_end" TIMESTAMPTZ(6),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon_key" TEXT,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description_html" TEXT,
    "how_to_use" TEXT,
    "ingredients" TEXT,
    "skin_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "product_status" NOT NULL DEFAULT 'draft',
    "has_3d" BOOLEAN NOT NULL DEFAULT false,
    "has_video" BOOLEAN NOT NULL DEFAULT false,
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "sold_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "shade_name" TEXT,
    "shade_hex" CHAR(7),
    "size_label" TEXT,
    "price" BIGINT NOT NULL,
    "compare_at_price" BIGINT,
    "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "weight_grams" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_media" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "type" "media_type" NOT NULL,
    "file_key" TEXT NOT NULL,
    "poster_key" TEXT,
    "stream_uid" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" BIGINT,
    "status" "media_status" NOT NULL DEFAULT 'uploading',
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "alt_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlists" (
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("user_id","product_id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "guest_token" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "cart_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "qty" INTEGER NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("cart_id","variant_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'awaiting_payment',
    "payment_method" "payment_method" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    "subtotal" BIGINT NOT NULL,
    "shipping_total" BIGINT NOT NULL,
    "discount_total" BIGINT NOT NULL DEFAULT 0,
    "grand_total" BIGINT NOT NULL,
    "address_snapshot" JSONB NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "placed_ip" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_orders" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "status" "seller_order_status" NOT NULL,
    "subtotal" BIGINT NOT NULL,
    "shipping_fee" BIGINT NOT NULL,
    "commission_bps" INTEGER NOT NULL,
    "commission_amount" BIGINT NOT NULL,
    "gateway_fee_share" BIGINT NOT NULL DEFAULT 0,
    "seller_net" BIGINT NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "shipped_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "delivery_proof" "delivery_proof",
    "release_at" TIMESTAMPTZ(6),
    "released_at" TIMESTAMPTZ(6),
    "cancelled_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "seller_order_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "title_snapshot" TEXT NOT NULL,
    "shade_snapshot" TEXT,
    "unit_price" BIGINT NOT NULL,
    "qty" INTEGER NOT NULL,
    "line_total" BIGINT NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" BIGSERIAL NOT NULL,
    "seller_order_id" UUID NOT NULL,
    "from_status" "seller_order_status",
    "to_status" "seller_order_status" NOT NULL,
    "actor_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "purpose" TEXT NOT NULL,
    "purpose_ref_id" UUID,
    "provider" TEXT NOT NULL,
    "method" "payment_method" NOT NULL,
    "provider_ref" TEXT,
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "fee_amount" BIGINT,
    "status" "payment_status" NOT NULL DEFAULT 'created',
    "idempotency_key" TEXT NOT NULL,
    "failure_code" TEXT,
    "captured_at" TIMESTAMPTZ(6),
    "raw_last_status" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "seller_order_id" UUID,
    "amount" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "refund_status" NOT NULL DEFAULT 'requested',
    "provider_ref" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "requested_by" UUID,
    "approved_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "signature_ok" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "error" TEXT,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" TEXT NOT NULL,
    "user_id" UUID,
    "request_hash" TEXT NOT NULL,
    "response" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "owner_type" "ledger_owner" NOT NULL,
    "owner_id" UUID,
    "type" "ledger_account_type" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "ref_type" TEXT NOT NULL,
    "ref_id" UUID NOT NULL,
    "memo" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" BIGSERIAL NOT NULL,
    "transaction_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "direction" "entry_direction" NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    "status" "payout_status" NOT NULL DEFAULT 'requested',
    "bank_reference" TEXT,
    "requested_by" UUID,
    "approved_by" UUID,
    "second_approver" UUID,
    "failure_reason" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ(6),

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_issues" (
    "id" UUID NOT NULL,
    "run_date" DATE NOT NULL,
    "provider" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payment_id" UUID,
    "provider_ref" TEXT,
    "expected" BIGINT,
    "actual" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolved_by" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "reconciliation_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_invoices" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "period_start" DATE,
    "period_end" DATE,
    "amount" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "due_at" DATE,
    "pdf_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_accounts" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT,
    "credentials_enc" BYTEA,
    "credentials_last4" TEXT,
    "webhook_secret_enc" BYTEA,
    "pickup_address" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_settings" (
    "seller_id" UUID NOT NULL,
    "mode" "shipping_mode" NOT NULL DEFAULT 'manual',
    "default_account_id" UUID,
    "handling_days" SMALLINT NOT NULL DEFAULT 1,
    "free_shipping_min" BIGINT,
    "cod_enabled" BOOLEAN NOT NULL DEFAULT true,
    "live_quotes" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "shipping_settings_pkey" PRIMARY KEY ("seller_id")
);

-- CreateTable
CREATE TABLE "shipping_rates" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "zone" TEXT NOT NULL,
    "min_weight_g" INTEGER NOT NULL DEFAULT 0,
    "max_weight_g" INTEGER NOT NULL,
    "price" BIGINT NOT NULL,
    "est_days_min" SMALLINT NOT NULL,
    "est_days_max" SMALLINT NOT NULL,

    CONSTRAINT "shipping_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "seller_order_id" UUID NOT NULL,
    "shipping_account_id" UUID,
    "provider" TEXT NOT NULL,
    "tracking_number" TEXT,
    "tracking_url" TEXT,
    "label_key" TEXT,
    "status" "shipment_status" NOT NULL DEFAULT 'booked',
    "cod_amount" BIGINT,
    "booked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ(6),
    "proof_source" "delivery_proof",
    "last_polled_at" TIMESTAMPTZ(6),

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" BIGSERIAL NOT NULL,
    "shipment_id" UUID NOT NULL,
    "status" "shipment_status" NOT NULL,
    "raw_status" TEXT,
    "location" TEXT,
    "message" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL,
    "seller_order_id" UUID NOT NULL,
    "opened_by" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "dispute_status" NOT NULL DEFAULT 'open',
    "seller_response" TEXT,
    "resolution_note" TEXT,
    "refund_amount" BIGINT,
    "resolved_by" UUID,
    "seller_deadline" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "photo_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'published',
    "seller_reply" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_packages" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_monthly" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    "seats_total" INTEGER,
    "sponsored_products_limit" INTEGER,
    "impressions_quota" INTEGER NOT NULL,
    "slot_days" JSONB NOT NULL,
    "features" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "ad_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_subscriptions" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "billing_cycle" "billing_cycle" NOT NULL DEFAULT 'monthly',
    "status" "sub_status" NOT NULL DEFAULT 'pending_payment',
    "current_period_start" TIMESTAMPTZ(6),
    "current_period_end" TIMESTAMPTZ(6),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_waitlist" (
    "package_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified_at" TIMESTAMPTZ(6),

    CONSTRAINT "ad_waitlist_pkey" PRIMARY KEY ("package_id","seller_id")
);

-- CreateTable
CREATE TABLE "ad_slots" (
    "id" UUID NOT NULL,
    "code" "ad_slot_code" NOT NULL,
    "category_id" UUID,
    "positions" SMALLINT NOT NULL DEFAULT 1,

    CONSTRAINT "ad_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_creatives" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "slot_code" "ad_slot_code" NOT NULL,
    "media_type" "media_type" NOT NULL,
    "file_key" TEXT NOT NULL,
    "headline" TEXT,
    "cta_label" TEXT,
    "target_product_id" UUID,
    "status" "creative_status" NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reject_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "creative_id" UUID,
    "product_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "status" "campaign_status" NOT NULL DEFAULT 'draft',
    "start_at" TIMESTAMPTZ(6),
    "end_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_slot_bookings" (
    "id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "position" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_slot_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_stats_daily" (
    "campaign_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "slot_code" "ad_slot_code" NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "add_to_carts" INTEGER NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "revenue" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "ad_stats_daily_pkey" PRIMARY KEY ("campaign_id","day","slot_code")
);

-- CreateTable
CREATE TABLE "cms_hero_scenes" (
    "id" UUID NOT NULL,
    "sort_order" SMALLINT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "media_key" TEXT,
    "model_key" TEXT,
    "campaign_id" UUID,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cms_hero_scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_pages" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body_md" TEXT NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "sent_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" UUID,
    "actor_role" "user_role",
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID,
    "reason" TEXT,
    "ip" INET,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_family_id_idx" ON "sessions"("family_id");

-- CreateIndex
CREATE INDEX "otp_codes_target_purpose_created_at_idx" ON "otp_codes"("target", "purpose", "created_at" DESC);

-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_slug_key" ON "sellers"("slug");

-- CreateIndex
CREATE INDEX "sellers_status_idx" ON "sellers"("status");

-- CreateIndex
CREATE INDEX "sellers_reviewed_by_idx" ON "sellers"("reviewed_by");

-- CreateIndex
CREATE INDEX "seller_members_user_id_idx" ON "seller_members"("user_id");

-- CreateIndex
CREATE INDEX "seller_documents_seller_id_idx" ON "seller_documents"("seller_id");

-- CreateIndex
CREATE INDEX "seller_documents_reviewed_by_idx" ON "seller_documents"("reviewed_by");

-- CreateIndex
CREATE INDEX "seller_bank_accounts_seller_id_idx" ON "seller_bank_accounts"("seller_id");

-- CreateIndex
CREATE INDEX "seller_bank_accounts_iban_hash_idx" ON "seller_bank_accounts"("iban_hash");

-- CreateIndex
CREATE INDEX "seller_application_log_seller_id_created_at_idx" ON "seller_application_log"("seller_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "seller_application_log_actor_id_idx" ON "seller_application_log"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "brands_owner_seller_id_idx" ON "brands"("owner_seller_id");

-- CreateIndex
CREATE INDEX "brand_authorizations_seller_id_idx" ON "brand_authorizations"("seller_id");

-- CreateIndex
CREATE INDEX "brand_authorizations_decided_by_idx" ON "brand_authorizations"("decided_by");

-- CreateIndex
CREATE UNIQUE INDEX "brand_authorizations_brand_id_seller_id_key" ON "brand_authorizations"("brand_id", "seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "selling_plans_code_key" ON "selling_plans"("code");

-- CreateIndex
CREATE INDEX "seller_subscriptions_seller_id_idx" ON "seller_subscriptions"("seller_id");

-- CreateIndex
CREATE INDEX "seller_subscriptions_plan_id_idx" ON "seller_subscriptions"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_seller_id_status_idx" ON "products"("seller_id", "status");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_sku_key" ON "product_variants"("product_id", "sku");

-- CreateIndex
CREATE INDEX "product_media_product_id_sort_order_idx" ON "product_media"("product_id", "sort_order");

-- CreateIndex
CREATE INDEX "product_media_variant_id_idx" ON "product_media"("variant_id");

-- CreateIndex
CREATE INDEX "wishlists_product_id_idx" ON "wishlists"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "carts_user_id_key" ON "carts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "carts_guest_token_key" ON "carts"("guest_token");

-- CreateIndex
CREATE INDEX "cart_items_variant_id_idx" ON "cart_items"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "orders_customer_id_created_at_idx" ON "orders"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "seller_orders_seller_id_status_created_at_idx" ON "seller_orders"("seller_id", "status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "seller_orders_order_id_seller_id_key" ON "seller_orders"("order_id", "seller_id");

-- CreateIndex
CREATE INDEX "order_items_seller_order_id_idx" ON "order_items"("seller_order_id");

-- CreateIndex
CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "order_status_history_seller_order_id_created_at_idx" ON "order_status_history"("seller_order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_status_history_actor_id_idx" ON "order_status_history"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_idempotency_key_key" ON "refunds"("idempotency_key");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_seller_order_id_idx" ON "refunds"("seller_order_id");

-- CreateIndex
CREATE INDEX "refunds_requested_by_idx" ON "refunds"("requested_by");

-- CreateIndex
CREATE INDEX "refunds_approved_by_idx" ON "refunds"("approved_by");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_source_event_id_key" ON "webhook_events"("source", "event_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys"("created_at");

-- CreateIndex
CREATE INDEX "ledger_transactions_ref_type_ref_id_idx" ON "ledger_transactions"("ref_type", "ref_id");

-- CreateIndex
CREATE INDEX "ledger_transactions_created_by_idx" ON "ledger_transactions"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_kind_ref_type_ref_id_key" ON "ledger_transactions"("kind", "ref_type", "ref_id");

-- CreateIndex
CREATE INDEX "ledger_entries_account_id_created_at_idx" ON "ledger_entries"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_idempotency_key_key" ON "payouts"("idempotency_key");

-- CreateIndex
CREATE INDEX "payouts_seller_id_requested_at_idx" ON "payouts"("seller_id", "requested_at" DESC);

-- CreateIndex
CREATE INDEX "payouts_bank_account_id_idx" ON "payouts"("bank_account_id");

-- CreateIndex
CREATE INDEX "payouts_requested_by_idx" ON "payouts"("requested_by");

-- CreateIndex
CREATE INDEX "payouts_approved_by_idx" ON "payouts"("approved_by");

-- CreateIndex
CREATE INDEX "payouts_second_approver_idx" ON "payouts"("second_approver");

-- CreateIndex
CREATE INDEX "reconciliation_issues_payment_id_idx" ON "reconciliation_issues"("payment_id");

-- CreateIndex
CREATE INDEX "reconciliation_issues_resolved_by_idx" ON "reconciliation_issues"("resolved_by");

-- CreateIndex
CREATE UNIQUE INDEX "seller_invoices_number_key" ON "seller_invoices"("number");

-- CreateIndex
CREATE INDEX "seller_invoices_seller_id_created_at_idx" ON "seller_invoices"("seller_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "shipping_accounts_seller_id_idx" ON "shipping_accounts"("seller_id");

-- CreateIndex
CREATE INDEX "shipping_settings_default_account_id_idx" ON "shipping_settings"("default_account_id");

-- CreateIndex
CREATE INDEX "shipping_rates_seller_id_zone_idx" ON "shipping_rates"("seller_id", "zone");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_seller_order_id_key" ON "shipments"("seller_order_id");

-- CreateIndex
CREATE INDEX "shipments_shipping_account_id_idx" ON "shipments"("shipping_account_id");

-- CreateIndex
CREATE INDEX "shipments_provider_tracking_number_idx" ON "shipments"("provider", "tracking_number");

-- CreateIndex
CREATE INDEX "shipment_events_shipment_id_occurred_at_idx" ON "shipment_events"("shipment_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_events_shipment_id_status_occurred_at_key" ON "shipment_events"("shipment_id", "status", "occurred_at");

-- CreateIndex
CREATE INDEX "disputes_seller_order_id_idx" ON "disputes"("seller_order_id");

-- CreateIndex
CREATE INDEX "disputes_opened_by_idx" ON "disputes"("opened_by");

-- CreateIndex
CREATE INDEX "disputes_resolved_by_idx" ON "disputes"("resolved_by");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_order_item_id_key" ON "reviews"("order_item_id");

-- CreateIndex
CREATE INDEX "reviews_customer_id_idx" ON "reviews"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_packages_code_key" ON "ad_packages"("code");

-- CreateIndex
CREATE INDEX "ad_subscriptions_seller_id_idx" ON "ad_subscriptions"("seller_id");

-- CreateIndex
CREATE INDEX "ad_subscriptions_package_id_status_idx" ON "ad_subscriptions"("package_id", "status");

-- CreateIndex
CREATE INDEX "ad_waitlist_seller_id_idx" ON "ad_waitlist"("seller_id");

-- CreateIndex
CREATE INDEX "ad_slots_category_id_idx" ON "ad_slots"("category_id");

-- CreateIndex
CREATE INDEX "ad_creatives_seller_id_idx" ON "ad_creatives"("seller_id");

-- CreateIndex
CREATE INDEX "ad_creatives_target_product_id_idx" ON "ad_creatives"("target_product_id");

-- CreateIndex
CREATE INDEX "ad_creatives_reviewed_by_idx" ON "ad_creatives"("reviewed_by");

-- CreateIndex
CREATE INDEX "ad_campaigns_subscription_id_idx" ON "ad_campaigns"("subscription_id");

-- CreateIndex
CREATE INDEX "ad_campaigns_seller_id_idx" ON "ad_campaigns"("seller_id");

-- CreateIndex
CREATE INDEX "ad_campaigns_creative_id_idx" ON "ad_campaigns"("creative_id");

-- CreateIndex
CREATE INDEX "ad_slot_bookings_campaign_id_idx" ON "ad_slot_bookings"("campaign_id");

-- CreateIndex
CREATE INDEX "ad_slot_bookings_day_slot_id_idx" ON "ad_slot_bookings"("day", "slot_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_slot_bookings_slot_id_day_position_key" ON "ad_slot_bookings"("slot_id", "day", "position");

-- CreateIndex
CREATE INDEX "cms_hero_scenes_campaign_id_idx" ON "cms_hero_scenes"("campaign_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "seller_members" ADD CONSTRAINT "seller_members_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "seller_members" ADD CONSTRAINT "seller_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "manufacturer_profiles" ADD CONSTRAINT "manufacturer_profiles_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "seller_documents" ADD CONSTRAINT "seller_documents_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "seller_documents" ADD CONSTRAINT "seller_documents_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "seller_bank_accounts" ADD CONSTRAINT "seller_bank_accounts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "seller_application_log" ADD CONSTRAINT "seller_application_log_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "seller_application_log" ADD CONSTRAINT "seller_application_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_owner_seller_id_fkey" FOREIGN KEY ("owner_seller_id") REFERENCES "sellers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "brand_authorizations" ADD CONSTRAINT "brand_authorizations_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "brand_authorizations" ADD CONSTRAINT "brand_authorizations_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "brand_authorizations" ADD CONSTRAINT "brand_authorizations_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "seller_subscriptions" ADD CONSTRAINT "seller_subscriptions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "seller_subscriptions" ADD CONSTRAINT "seller_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "selling_plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seller_order_id_fkey" FOREIGN KEY ("seller_order_id") REFERENCES "seller_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_seller_order_id_fkey" FOREIGN KEY ("seller_order_id") REFERENCES "seller_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_seller_order_id_fkey" FOREIGN KEY ("seller_order_id") REFERENCES "seller_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "seller_bank_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_second_approver_fkey" FOREIGN KEY ("second_approver") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "seller_invoices" ADD CONSTRAINT "seller_invoices_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shipping_accounts" ADD CONSTRAINT "shipping_accounts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shipping_settings" ADD CONSTRAINT "shipping_settings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shipping_settings" ADD CONSTRAINT "shipping_settings_default_account_id_fkey" FOREIGN KEY ("default_account_id") REFERENCES "shipping_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_seller_order_id_fkey" FOREIGN KEY ("seller_order_id") REFERENCES "seller_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_shipping_account_id_fkey" FOREIGN KEY ("shipping_account_id") REFERENCES "shipping_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_seller_order_id_fkey" FOREIGN KEY ("seller_order_id") REFERENCES "seller_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ad_subscriptions" ADD CONSTRAINT "ad_subscriptions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ad_subscriptions" ADD CONSTRAINT "ad_subscriptions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "ad_packages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ad_waitlist" ADD CONSTRAINT "ad_waitlist_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "ad_packages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ad_waitlist" ADD CONSTRAINT "ad_waitlist_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ad_slots" ADD CONSTRAINT "ad_slots_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ad_creatives" ADD CONSTRAINT "ad_creatives_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ad_creatives" ADD CONSTRAINT "ad_creatives_target_product_id_fkey" FOREIGN KEY ("target_product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ad_creatives" ADD CONSTRAINT "ad_creatives_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "ad_subscriptions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "ad_creatives"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ad_slot_bookings" ADD CONSTRAINT "ad_slot_bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "ad_slots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ad_slot_bookings" ADD CONSTRAINT "ad_slot_bookings_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ad_stats_daily" ADD CONSTRAINT "ad_stats_daily_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cms_hero_scenes" ADD CONSTRAINT "cms_hero_scenes_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;


-- =============================================================================
-- HAND-WRITTEN SECTION (not generated by Prisma)
-- Source: docs/05-database-schema.md. Prisma 6 cannot express the objects below,
-- so they live only here. Do NOT declare the partial unique indexes in
-- schema.prisma as well. Keep this section in sync with the doc.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Array columns: doc declares them NOT NULL DEFAULT '{}'
--    (Prisma scalar lists are always created nullable).
-- -----------------------------------------------------------------------------
ALTER TABLE "products"     ALTER COLUMN "skin_types"    SET NOT NULL;
ALTER TABLE "products"     ALTER COLUMN "tags"          SET NOT NULL;
ALTER TABLE "disputes"     ALTER COLUMN "evidence_keys" SET NOT NULL;
ALTER TABLE "reviews"      ALTER COLUMN "photo_keys"    SET NOT NULL;
ALTER TABLE "ad_campaigns" ALTER COLUMN "product_ids"   SET NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. CHECK constraints
-- -----------------------------------------------------------------------------
ALTER TABLE "users"
  ADD CONSTRAINT "users_full_name_length_check" CHECK (length("full_name") <= 120),
  ADD CONSTRAINT "users_email_or_phone_check"   CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);

ALTER TABLE "products"
  ADD CONSTRAINT "products_title_length_check" CHECK (length("title") <= 200);

ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_shade_hex_check"        CHECK ("shade_hex" ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT "product_variants_price_check"            CHECK ("price" > 0),
  ADD CONSTRAINT "product_variants_compare_at_price_check" CHECK ("compare_at_price" IS NULL OR "compare_at_price" > "price"),
  ADD CONSTRAINT "product_variants_stock_check"            CHECK ("stock" >= 0);

ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_qty_check" CHECK ("qty" BETWEEN 1 AND 20);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_grand_total_check"
  CHECK ("grand_total" = "subtotal" + "shipping_total" - "discount_total");

ALTER TABLE "seller_orders"
  ADD CONSTRAINT "seller_orders_seller_net_check"
  CHECK ("seller_net" = "subtotal" + "shipping_fee" - "commission_amount" - "gateway_fee_share");

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_qty_check"        CHECK ("qty" > 0),
  ADD CONSTRAINT "order_items_line_total_check" CHECK ("line_total" = "unit_price" * "qty");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_check" CHECK ("amount" > 0);

ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_amount_check" CHECK ("amount" > 0);

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_amount_check" CHECK ("amount" > 0);

ALTER TABLE "payouts"
  ADD CONSTRAINT "payouts_amount_check" CHECK ("amount" > 0);

ALTER TABLE "shipping_rates"
  ADD CONSTRAINT "shipping_rates_weight_range_check" CHECK ("max_weight_g" > "min_weight_g");

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_check"      CHECK ("rating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "reviews_body_length_check" CHECK (length("body") <= 2000);

-- -----------------------------------------------------------------------------
-- 3. Partial indexes (unique and non-unique)
-- -----------------------------------------------------------------------------
-- 4.1 addresses
CREATE UNIQUE INDEX "one_default_address" ON "addresses" ("user_id") WHERE "is_default";

-- 4.2 sellers / seller_documents
CREATE UNIQUE INDEX "sellers_owner_user_id_idx" ON "sellers" ("owner_user_id") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "sellers_ntn_idx" ON "sellers" ("ntn")
  WHERE "ntn" IS NOT NULL AND "deleted_at" IS NULL;                 -- duplicate account check
CREATE INDEX "seller_documents_expires_at_idx" ON "seller_documents" ("expires_at") WHERE "status" = 'approved';

-- 4.4 seller_subscriptions
CREATE UNIQUE INDEX "one_active_plan" ON "seller_subscriptions" ("seller_id")
  WHERE "status" IN ('active', 'past_due');
CREATE INDEX "seller_subscriptions_current_period_end_idx" ON "seller_subscriptions" ("current_period_end")
  WHERE "status" = 'active';

-- 4.5 products
CREATE INDEX "products_category_id_idx" ON "products" ("category_id") WHERE "status" = 'live';

-- 4.6 orders / seller_orders
CREATE INDEX "orders_created_at_idx" ON "orders" ("created_at") WHERE "status" = 'awaiting_payment';
CREATE INDEX "seller_orders_release_at_idx" ON "seller_orders" ("release_at")
  WHERE "status" = 'delivered';                                     -- release job
CREATE INDEX "seller_orders_shipped_at_idx" ON "seller_orders" ("shipped_at")
  WHERE "status" IN ('shipped', 'in_transit');                      -- auto-confirm job

-- 4.7 payments / webhook_events
CREATE UNIQUE INDEX "payments_provider_provider_ref_idx" ON "payments" ("provider", "provider_ref")
  WHERE "provider_ref" IS NOT NULL;
CREATE INDEX "payments_status_created_at_idx" ON "payments" ("status", "created_at")
  WHERE "status" IN ('created', 'pending');
CREATE INDEX "webhook_events_received_at_idx" ON "webhook_events" ("received_at") WHERE "processed_at" IS NULL;

-- 4.9 payouts / reconciliation_issues
CREATE INDEX "payouts_status_idx" ON "payouts" ("status")
  WHERE "status" IN ('requested', 'approved', 'processing');
CREATE INDEX "reconciliation_issues_run_date_idx" ON "reconciliation_issues" ("run_date") WHERE "status" = 'open';

-- 4.10 shipments (tracking poll job)
CREATE INDEX "shipments_last_polled_at_idx" ON "shipments" ("last_polled_at")
  WHERE "status" NOT IN ('delivered', 'returned', 'cancelled');

-- 4.11 disputes / reviews
CREATE INDEX "disputes_status_idx" ON "disputes" ("status")
  WHERE "status" NOT IN ('resolved_refund', 'resolved_release', 'closed');
CREATE INDEX "reviews_product_id_created_at_idx" ON "reviews" ("product_id", "created_at" DESC)
  WHERE "status" = 'published';

-- 4.12 advertising
CREATE UNIQUE INDEX "one_active_ad_sub" ON "ad_subscriptions" ("seller_id")
  WHERE "status" IN ('active', 'past_due');
CREATE INDEX "ad_creatives_status_idx" ON "ad_creatives" ("status") WHERE "status" = 'pending';
CREATE INDEX "ad_campaigns_status_idx" ON "ad_campaigns" ("status") WHERE "status" = 'live';

-- -----------------------------------------------------------------------------
-- 4. UNIQUE NULLS NOT DISTINCT (PostgreSQL 15+)
--    schema.prisma declares these as plain @@unique with the same index names so
--    Prisma sees no drift; the real index (NULLS NOT DISTINCT) is created only here.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX "ledger_accounts_owner_type_owner_id_type_currency_key"
  ON "ledger_accounts" ("owner_type", "owner_id", "type", "currency") NULLS NOT DISTINCT;

CREATE UNIQUE INDEX "ad_slots_code_category_id_key"
  ON "ad_slots" ("code", "category_id") NULLS NOT DISTINCT;

-- -----------------------------------------------------------------------------
-- 5. Ledger: balanced-transaction constraint trigger + balances view (doc §4.8)
-- -----------------------------------------------------------------------------
-- Every transaction must balance: sum(debits) = sum(credits). Checked at COMMIT.
CREATE FUNCTION assert_txn_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT coalesce(sum(CASE WHEN direction = 'debit' THEN amount ELSE -amount END), 0)
        FROM ledger_entries WHERE transaction_id = NEW.transaction_id) <> 0 THEN
    RAISE EXCEPTION 'Ledger transaction % is not balanced', NEW.transaction_id;
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER ledger_balanced
  AFTER INSERT ON ledger_entries DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_txn_balanced();

CREATE VIEW ledger_balances AS
SELECT account_id,
       sum(CASE WHEN direction = 'debit' THEN amount ELSE -amount END) AS balance
FROM ledger_entries GROUP BY account_id;

-- -----------------------------------------------------------------------------
-- 6. Append-only grants (doc §4.8, §4.13)
--    The app role may only INSERT/SELECT on ledger + audit tables. Runs only when
--    the `app_user` role exists (it does not in local dev / CI).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON ledger_entries, ledger_transactions FROM app_user;
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM app_user;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 7. Row-Level Security (doc §5) — second lock for seller data.
--    The API sets per request, inside the transaction:
--      SELECT set_config('app.seller_id', '<uuid from token>', true);
--      SELECT set_config('app.role', 'seller', true);
--    Admin/background jobs set app.role = 'system'; storefront reads use 'public_read'.
--
--    IMPORTANT: table owners bypass RLS. Local dev / CI connect as the owner (`hb`),
--    so these policies do not restrict anything there — that is expected. In staging
--    and prod the API MUST connect as the non-owner `app_user` role so RLS applies.
--
--    NULLIF(..., '') guards pooled connections where app.seller_id was set earlier in
--    the session and reads back as '' (''::uuid would raise). Logged in docs/memory.md.
--
--    Applied to every seller-scoped table that has a seller_id column:
--    products, seller_orders, shipping_accounts, shipping_settings, shipping_rates,
--    payouts, ad_subscriptions, ad_waitlist, ad_creatives, ad_campaigns.
--    (shipments, ad_slot_bookings, ad_stats_daily have no seller_id column and are
--    reached through their parent rows.)
-- -----------------------------------------------------------------------------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_own_products ON products
  USING (
    (SELECT current_setting('app.role', true)) IN ('admin','support','finance','system','public_read')
    OR seller_id = NULLIF((SELECT current_setting('app.seller_id', true)), '')::uuid
  );

ALTER TABLE seller_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_own_seller_orders ON seller_orders
  USING (
    (SELECT current_setting('app.role', true)) IN ('admin','support','finance','system','public_read')
    OR seller_id = NULLIF((SELECT current_setting('app.seller_id', true)), '')::uuid
  );

ALTER TABLE shipping_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_own_shipping_accounts ON shipping_accounts
  USING (
    (SELECT current_setting('app.role', true)) IN ('admin','support','finance','system','public_read')
    OR seller_id = NULLIF((SELECT current_setting('app.seller_id', true)), '')::uuid
  );

ALTER TABLE shipping_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_own_shipping_settings ON shipping_settings
  USING (
    (SELECT current_setting('app.role', true)) IN ('admin','support','finance','system','public_read')
    OR seller_id = NULLIF((SELECT current_setting('app.seller_id', true)), '')::uuid
  );

ALTER TABLE shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_own_shipping_rates ON shipping_rates
  USING (
    (SELECT current_setting('app.role', true)) IN ('admin','support','finance','system','public_read')
    OR seller_id = NULLIF((SELECT current_setting('app.seller_id', true)), '')::uuid
  );

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_own_payouts ON payouts
  USING (
    (SELECT current_setting('app.role', true)) IN ('admin','support','finance','system','public_read')
    OR seller_id = NULLIF((SELECT current_setting('app.seller_id', true)), '')::uuid
  );

ALTER TABLE ad_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_own_ad_subscriptions ON ad_subscriptions
  USING (
    (SELECT current_setting('app.role', true)) IN ('admin','support','finance','system','public_read')
    OR seller_id = NULLIF((SELECT current_setting('app.seller_id', true)), '')::uuid
  );

ALTER TABLE ad_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_own_ad_waitlist ON ad_waitlist
  USING (
    (SELECT current_setting('app.role', true)) IN ('admin','support','finance','system','public_read')
    OR seller_id = NULLIF((SELECT current_setting('app.seller_id', true)), '')::uuid
  );

ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_own_ad_creatives ON ad_creatives
  USING (
    (SELECT current_setting('app.role', true)) IN ('admin','support','finance','system','public_read')
    OR seller_id = NULLIF((SELECT current_setting('app.seller_id', true)), '')::uuid
  );

ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_own_ad_campaigns ON ad_campaigns
  USING (
    (SELECT current_setting('app.role', true)) IN ('admin','support','finance','system','public_read')
    OR seller_id = NULLIF((SELECT current_setting('app.seller_id', true)), '')::uuid
  );
