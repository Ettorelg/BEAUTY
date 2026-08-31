import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL non configurato");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const statements = [
  'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" text',
  'ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true',
  'ALTER TABLE "staff_members" ADD COLUMN IF NOT EXISTS "user_id" uuid',
  'CREATE UNIQUE INDEX IF NOT EXISTS "staff_members_business_user_unique" ON "staff_members" ("business_id", "user_id")',
  ...["address text", "city text", "postal_code text", "phone text", "email text", "description text", "website text", "instagram text", "logo_key text", "cover_key text", "gallery_keys text"].flatMap((column) => [
    `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS ${column}`,
    `ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS ${column}`,
  ]),
  `CREATE TABLE IF NOT EXISTS "fidelity_settings" (
    "business_id" uuid PRIMARY KEY REFERENCES "businesses"("id") ON DELETE CASCADE,
    "spend_cents" integer NOT NULL DEFAULT 1000,
    "points_award" integer NOT NULL DEFAULT 1,
    "points_validity_months" integer NOT NULL DEFAULT 12,
    "allow_reward_stacking" boolean NOT NULL DEFAULT false,
    "reward_points" integer NOT NULL DEFAULT 10,
    "reward_type" text NOT NULL DEFAULT 'DISCOUNT_EUR',
    "reward_value" integer NOT NULL DEFAULT 500,
    "reward_service_id" uuid REFERENCES "services"("id") ON DELETE SET NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now())`,
  'ALTER TABLE "fidelity_settings" ADD COLUMN IF NOT EXISTS "reward_service_id" uuid REFERENCES "services"("id") ON DELETE SET NULL',
  'ALTER TABLE "fidelity_settings" ADD COLUMN IF NOT EXISTS "points_validity_months" integer NOT NULL DEFAULT 12',
  'ALTER TABLE "fidelity_settings" ADD COLUMN IF NOT EXISTS "allow_reward_stacking" boolean NOT NULL DEFAULT false',
  `CREATE TABLE IF NOT EXISTS "fidelity_rules" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,"points" integer NOT NULL,"type" text NOT NULL,"value" integer NOT NULL DEFAULT 0,"service_id" uuid REFERENCES "services"("id") ON DELETE SET NULL,"created_at" timestamptz NOT NULL DEFAULT now())`,
  'CREATE INDEX IF NOT EXISTS "fidelity_rules_business_idx" ON "fidelity_rules" ("business_id")',
  `CREATE TABLE IF NOT EXISTS "fidelity_cards" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,"customer_relation_id" uuid NOT NULL REFERENCES "customer_relations"("id") ON DELETE CASCADE,"card_number" text NOT NULL,"points" integer NOT NULL DEFAULT 0,"points_expires_at" timestamptz,"created_at" timestamptz NOT NULL DEFAULT now(),"updated_at" timestamptz NOT NULL DEFAULT now())`,
  'ALTER TABLE "fidelity_cards" ADD COLUMN IF NOT EXISTS "points_expires_at" timestamptz',
  'CREATE UNIQUE INDEX IF NOT EXISTS "fidelity_cards_business_customer_unique" ON "fidelity_cards" ("business_id","customer_relation_id")',
  'CREATE UNIQUE INDEX IF NOT EXISTS "fidelity_cards_number_unique" ON "fidelity_cards" ("card_number")',
  'CREATE INDEX IF NOT EXISTS "fidelity_cards_business_idx" ON "fidelity_cards" ("business_id")',
  `CREATE TABLE IF NOT EXISTS "fidelity_promotions" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,"service_id" uuid NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,"discount_percent" integer NOT NULL,"starts_at" timestamptz NOT NULL,"ends_at" timestamptz NOT NULL,"created_at" timestamptz NOT NULL DEFAULT now())`,
  'ALTER TABLE "fidelity_promotions" ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now()',
  'CREATE INDEX IF NOT EXISTS "fidelity_promotions_business_idx" ON "fidelity_promotions" ("business_id")',
  `CREATE TABLE IF NOT EXISTS "fidelity_redemptions" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,"customer_relation_id" uuid NOT NULL REFERENCES "customer_relations"("id") ON DELETE CASCADE,"rule_id" uuid REFERENCES "fidelity_rules"("id") ON DELETE SET NULL,"appointment_id" uuid REFERENCES "appointments"("id") ON DELETE SET NULL,"points_spent" integer NOT NULL,"reward_type" text NOT NULL,"reward_value" integer NOT NULL DEFAULT 0,"service_id" uuid REFERENCES "services"("id") ON DELETE SET NULL,"reversed_at" timestamptz,"created_at" timestamptz NOT NULL DEFAULT now())`,
  'ALTER TABLE "fidelity_redemptions" ADD COLUMN IF NOT EXISTS "appointment_id" uuid REFERENCES "appointments"("id") ON DELETE SET NULL',
  'ALTER TABLE "fidelity_redemptions" ADD COLUMN IF NOT EXISTS "reversed_at" timestamptz',
  'CREATE INDEX IF NOT EXISTS "fidelity_redemptions_business_customer_idx" ON "fidelity_redemptions" ("business_id","customer_relation_id")',
  'CREATE UNIQUE INDEX IF NOT EXISTS "fidelity_redemptions_appointment_unique" ON "fidelity_redemptions" ("appointment_id") WHERE "appointment_id" IS NOT NULL',
  'ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "reminder_sent_at" timestamptz',
];

try {
  await client.query("BEGIN");
  for (const statement of statements) await client.query(statement);
  await client.query("COMMIT");
  console.log(`Production schema ready (${statements.length} checks)`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
