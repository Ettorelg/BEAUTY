import pg from "pg";
let ready:Promise<void>|undefined;

export function ensureFidelitySchema(){
  if(ready)return ready;
  ready=(async()=>{
    const client=new pg.Client({connectionString:process.env.DATABASE_URL});
    await client.connect();
    try{
      await client.query('ALTER TABLE "staff_members" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL');
      await client.query('CREATE TABLE IF NOT EXISTS "fidelity_settings" ("business_id" uuid PRIMARY KEY REFERENCES "businesses"("id") ON DELETE CASCADE,"spend_cents" integer NOT NULL DEFAULT 1000,"points_award" integer NOT NULL DEFAULT 1,"reward_points" integer NOT NULL DEFAULT 10,"reward_type" text NOT NULL DEFAULT \'DISCOUNT_EUR\',"reward_value" integer NOT NULL DEFAULT 500,"reward_service_id" uuid REFERENCES "services"("id") ON DELETE SET NULL,"created_at" timestamptz NOT NULL DEFAULT now(),"updated_at" timestamptz NOT NULL DEFAULT now())');
      await client.query('ALTER TABLE "fidelity_settings" ADD COLUMN IF NOT EXISTS "reward_service_id" uuid REFERENCES "services"("id") ON DELETE SET NULL');
      await client.query('CREATE TABLE IF NOT EXISTS "fidelity_rules" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,"points" integer NOT NULL,"type" text NOT NULL,"value" integer NOT NULL DEFAULT 0,"service_id" uuid REFERENCES "services"("id") ON DELETE SET NULL,"created_at" timestamptz NOT NULL DEFAULT now())');
      await client.query('CREATE INDEX IF NOT EXISTS "fidelity_rules_business_idx" ON "fidelity_rules" ("business_id")');
      await client.query('CREATE TABLE IF NOT EXISTS "fidelity_cards" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,"customer_relation_id" uuid NOT NULL REFERENCES "customer_relations"("id") ON DELETE CASCADE,"card_number" text NOT NULL,"points" integer NOT NULL DEFAULT 0,"created_at" timestamptz NOT NULL DEFAULT now(),"updated_at" timestamptz NOT NULL DEFAULT now())');
      await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "fidelity_cards_business_customer_unique" ON "fidelity_cards" ("business_id","customer_relation_id")');
      await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "fidelity_cards_number_unique" ON "fidelity_cards" ("card_number")');
      await client.query('CREATE TABLE IF NOT EXISTS "fidelity_promotions" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,"service_id" uuid NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,"discount_percent" integer NOT NULL,"starts_at" timestamptz NOT NULL,"ends_at" timestamptz NOT NULL,"active" boolean NOT NULL DEFAULT true,"created_at" timestamptz NOT NULL DEFAULT now())');
      await client.query('ALTER TABLE "fidelity_promotions" ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now()');
      await client.query('CREATE INDEX IF NOT EXISTS "fidelity_promotions_business_idx" ON "fidelity_promotions" ("business_id")');
      await client.query('ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "reminder_sent_at" timestamptz');
      await client.query('CREATE TABLE IF NOT EXISTS "fidelity_redemptions" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,"customer_relation_id" uuid NOT NULL REFERENCES "customer_relations"("id") ON DELETE CASCADE,"rule_id" uuid REFERENCES "fidelity_rules"("id") ON DELETE SET NULL,"points_spent" integer NOT NULL,"reward_type" text NOT NULL,"reward_value" integer NOT NULL DEFAULT 0,"service_id" uuid REFERENCES "services"("id") ON DELETE SET NULL,"created_at" timestamptz NOT NULL DEFAULT now())');
      await client.query('CREATE INDEX IF NOT EXISTS "fidelity_redemptions_business_customer_idx" ON "fidelity_redemptions" ("business_id","customer_relation_id")');
    }finally{await client.end()}
  })().catch(error=>{ready=undefined;throw error});
  return ready;
}
