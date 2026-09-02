ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "payment_status" text DEFAULT 'NOT_DUE' NOT NULL;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "appointments_customer_payment_idx" ON "appointments" ("business_id", "customer_relation_id", "payment_status");
