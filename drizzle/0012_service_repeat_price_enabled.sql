ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "repeat_price_enabled" boolean NOT NULL DEFAULT false;
