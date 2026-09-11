import { sql } from "drizzle-orm";
import { db } from "@/db/client";

let ready: Promise<void> | undefined;

export function ensureServicePricingSchema() {
  ready ??= (async () => {
    await db.execute(
      sql.raw(
        "ALTER TABLE services ADD COLUMN IF NOT EXISTS repeat_price numeric(10,2)",
      ),
    );
    await db.execute(
      sql.raw(
        "ALTER TABLE services ADD COLUMN IF NOT EXISTS repeat_price_enabled boolean NOT NULL DEFAULT false",
      ),
    );
    await db.execute(
      sql.raw(
        "ALTER TABLE services ADD COLUMN IF NOT EXISTS repeat_duration_minutes integer",
      ),
    );
    await db.execute(
      sql.raw(
        "ALTER TABLE services ADD COLUMN IF NOT EXISTS capacity integer NOT NULL DEFAULT 1",
      ),
    );
    await db.execute(
      sql.raw(
        "ALTER TABLE services ADD COLUMN IF NOT EXISTS waitlist_enabled boolean NOT NULL DEFAULT false",
      ),
    );
    await db.execute(
      sql.raw(
        "ALTER TABLE services ADD COLUMN IF NOT EXISTS waitlist_confirmation_minutes integer NOT NULL DEFAULT 120",
      ),
    );
    await db.execute(sql.raw("ALTER TABLE services ADD COLUMN IF NOT EXISTS adds_duration boolean NOT NULL DEFAULT true"));
    await db.execute(
      sql.raw(`CREATE TABLE IF NOT EXISTS service_waitlist (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE, staff_id uuid NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
      customer_relation_id uuid REFERENCES customer_relations(id) ON DELETE SET NULL, customer_name text NOT NULL, email text NOT NULL, phone text,
      starts_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'WAITING', offer_token_hash text, offer_expires_at timestamptz,
      offered_at timestamptz, confirmed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )`),
    );
    await db.execute(
      sql.raw(
        "CREATE INDEX IF NOT EXISTS service_waitlist_slot_idx ON service_waitlist(business_id, service_id, staff_id, starts_at, status, created_at)",
      ),
    );
    await db.execute(sql.raw("ALTER TABLE service_waitlist ADD COLUMN IF NOT EXISTS requested_day text"));
    await db.execute(sql.raw("ALTER TABLE service_waitlist ADD COLUMN IF NOT EXISTS any_staff boolean NOT NULL DEFAULT false"));
    await db.execute(sql.raw("CREATE INDEX IF NOT EXISTS service_waitlist_day_idx ON service_waitlist(business_id, service_id, requested_day, status, created_at)"));
  })();
  return ready;
}
