import pg from "pg";

let ready: Promise<void> | undefined;

export function ensureFidelitySchema() {
  if (ready) return ready;
  ready = (async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL non configurato.");
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      await client.query('CREATE TABLE IF NOT EXISTS "fidelity_settings" ("business_id" uuid PRIMARY KEY REFERENCES "businesses"("id") ON DELETE CASCADE, "spend_cents" integer NOT NULL DEFAULT 1000, "points_award" integer NOT NULL DEFAULT 1, "reward_points" integer NOT NULL DEFAULT 10, "reward_type" text NOT NULL DEFAULT \'DISCOUNT_EUR\', "reward_value" integer NOT NULL DEFAULT 500, "created_at" timestamp with time zone NOT NULL DEFAULT now(), "updated_at" timestamp with time zone NOT NULL DEFAULT now())');
      await client.query('CREATE TABLE IF NOT EXISTS "fidelity_cards" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE, "customer_relation_id" uuid NOT NULL REFERENCES "customer_relations"("id") ON DELETE CASCADE, "card_number" text NOT NULL, "points" integer NOT NULL DEFAULT 0, "created_at" timestamp with time zone NOT NULL DEFAULT now(), "updated_at" timestamp with time zone NOT NULL DEFAULT now())');
      await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "fidelity_cards_business_customer_unique" ON "fidelity_cards" ("business_id", "customer_relation_id")');
      await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "fidelity_cards_number_unique" ON "fidelity_cards" ("card_number")');
    } finally { await client.end(); }
  })();
  return ready;
}
